import { error, log } from './logger';
import type { CoffeeCard, CoffeeType } from '$lib/types';
import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import { kv } from '@vercel/kv';

const KV_READY = Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
let KV_WARNED = false;
function kvNotReadyOnce() {
  if (!KV_READY && !KV_WARNED) {
    KV_WARNED = true;
    log('Vercel KV отключён: отсутствуют KV_REST_API_URL/KV_REST_API_TOKEN. Используем файловый кеш.');
  }
}

// Простой LRU‑кеш в памяти
class LRU<K, V> {
  private map = new Map<K, V>();
  constructor(private limit = 64) {}
  get(key: K): V | undefined {
    const v = this.map.get(key);
    if (v !== undefined) {
      this.map.delete(key);
      this.map.set(key, v);
    }
    return v;
  }
  set(key: K, value: V) {
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, value);
    if (this.map.size > this.limit) {
      const it = this.map.keys().next();
      if (!it.done) {
        this.map.delete(it.value as K);
      }
    }
  }
}

// Глобальный экземпляр кеша
const cache = new LRU<string, unknown>(256);

// Ключи для кеша
const lastCardKey = (type: CoffeeType) => `last_card:${type}`;

// Пути для персистентности
const PERSIST_DIR = path.join(process.cwd(), '.server-cache');
const lastCardFile = (type: CoffeeType) => path.join(PERSIST_DIR, `last_card.${type}.json`);

async function persistLastCardFile(type: CoffeeType, card: CoffeeCard) {
  try {
    await fsp.mkdir(PERSIST_DIR, { recursive: true });
    await fsp.writeFile(lastCardFile(type), JSON.stringify(card), 'utf8');
    log(`Сохранили последнюю карточку (file:${type})`);
  } catch (e) {
    error(`Не удалось сохранить последнюю карточку (file:${type})`, e);
  }
}

async function persistLastCardKV(type: CoffeeType, card: CoffeeCard) {
  if (!KV_READY) {
    kvNotReadyOnce();
    return;
  }
  try {
    await kv.set(lastCardKey(type), card);
    log(`Сохранили последнюю карточку (KV:${type})`);
  } catch (e) {
    error(`Не удалось сохранить последнюю карточку (KV:${type})`, e);
  }
}

async function persistLastCardAll(type: CoffeeType, card: CoffeeCard) {
  // не блокируем критический путь
  try {
    await Promise.allSettled([persistLastCardFile(type, card), persistLastCardKV(type, card)]);
  } catch {}
}

function tryLoadLastCardSync(type: CoffeeType): CoffeeCard | undefined {
  try {
    const file = lastCardFile(type);
    if (fs.existsSync(file)) {
      const txt = fs.readFileSync(file, 'utf8');
      const obj = JSON.parse(txt) as CoffeeCard;
      // минимальная валидация
      if (obj && typeof obj.image === 'string' && typeof obj.title === 'string') {
        cache.set(lastCardKey(type), obj);
        log(`Загрузили последнюю карточку (file:${type})`);
        return obj;
      }
    }
  } catch (e) {
    error(`Не удалось загрузить карточку (file:${type})`, e);
  }
  return undefined;
}

// Лок для дедупликации параллельных запросов
const inflight = new Map<string, Promise<CoffeeCard>>();

export function getLastCard(type: CoffeeType): CoffeeCard | undefined {
  const inMem = cache.get(lastCardKey(type)) as CoffeeCard | undefined;
  if (inMem) return inMem;
  return tryLoadLastCardSync(type);
}

export async function getLastCardAsync(type: CoffeeType): Promise<CoffeeCard | undefined> {
  const inMem = cache.get(lastCardKey(type)) as CoffeeCard | undefined;
  if (inMem) return inMem;
  // Пытаемся взять из KV
  if (KV_READY) {
    try {
      const fromKv = (await kv.get<CoffeeCard>(lastCardKey(type))) ?? undefined;
      if (fromKv && typeof fromKv === 'object' && typeof (fromKv as any).image === 'string') {
        cache.set(lastCardKey(type), fromKv);
        log(`Загрузили последнюю карточку (KV:${type})`);
        return fromKv;
      }
    } catch (e) {
      error(`Не удалось получить карточку из KV (${type})`, e);
    }
  } else {
    kvNotReadyOnce();
  }
  // Файл как резерв
  const fromFile = tryLoadLastCardSync(type);
  if (fromFile) {
    // Попробуем догрузить в KV в фоне
    void persistLastCardKV(type, fromFile);
  }
  return fromFile;
}

export async function fetchAndCacheNext(fetchFn: typeof fetch, type: CoffeeType): Promise<CoffeeCard> {
  const key = `${type}`;
  if (inflight.has(key)) return inflight.get(key)!; // дедупликация на тип
  const p = (async () => {
    try {
      // Тянем данные из SampleAPIs (вариант B — используем поля как есть)
      const card = await fetchCoffeeFromSampleApis(fetchFn, type);
      cache.set(lastCardKey(type), card);
      // сохраняем асинхронно, не блокируя ответ (KV + file)
      void persistLastCardAll(type, card);
      log(`Закешировали новую карточку (${type})`);
      return card;
    } catch (e) {
      error(`Не удалось получить следующую карточку (${type})`, e);
      throw e;
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, p);
  return p;
}

// —————— Источники — горячий/холодный кофе ——————
async function fetchCoffeeFromSampleApis(fetchFn: typeof fetch, type: CoffeeType): Promise<CoffeeCard> {
  const url = type === 'iced' ? 'https://api.sampleapis.com/coffee/iced' : 'https://api.sampleapis.com/coffee/hot';
  const list = await withRetries(async () => {
    const res = await fetchWithTimeout(fetchFn, url, { headers: { Accept: 'application/json' } }, 5000);
    if (!res.ok) throw new Error(`Ошибка источника кофе (${type}): ${res.status}`);
    return (await res.json()) as any[];
  }, 3, 300);
  if (!Array.isArray(list) || list.length === 0) throw new Error(`Источник кофе (${type}) вернул пустой список`);

  const item = list[Math.floor(Math.random() * list.length)] as any;

  return {
    id: typeof item?.id === 'number' ? item.id : Math.floor(Math.random() * 1_000_000),
    title: String(item?.title ?? 'Unknown'),
    description: String(item?.description ?? ''),
    ingredients: Array.isArray(item?.ingredients) ? item.ingredients.map(String).filter(Boolean) : [],
    image: String(item?.image ?? '/placeholder.svg')
  } as CoffeeCard;
}

async function withRetries<T>(fn: () => Promise<T>, attempts = 3, baseDelayMs = 250): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (i < attempts - 1) {
        const delay = baseDelayMs * Math.pow(2, i);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  throw lastErr;
}

async function fetchWithTimeout(
  fetchFn: typeof fetch,
  resource: string,
  init?: RequestInit,
  timeoutMs = 5000
): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchFn(resource, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}
