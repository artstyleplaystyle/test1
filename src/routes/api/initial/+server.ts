import type { RequestHandler } from '@sveltejs/kit';
import type { CoffeeType } from '$lib/types';
import { getLastCard, getLastCardAsync, fetchAndCacheNext } from '$lib/server/cache';
import { log, error as logError } from '$lib/server/logger';

export const GET: RequestHandler = async ({ fetch, url }) => {
  try {
    const t = (url.searchParams.get('type') === 'iced' ? 'iced' : 'hot') as CoffeeType;
    let card = getLastCard(t);
    if (!card) {
      log(`INIT: кеш пуст (${t}), пробуем KV/file...`);
      card = (await getLastCardAsync(t)) ?? undefined;
    }
    if (!card) {
      log(`INIT: загружаем начальную карточку (${t})`);
      card = await fetchAndCacheNext(fetch, t);
    } else {
      log(`INIT: отдаём карточку из кеша (${t})`);
    }

    const payload = {
      id: Number((card as any).id ?? 0),
      title: (card as any).title,
      description: (card as any).description,
      ingredients: Array.isArray((card as any).ingredients) ? (card as any).ingredients : [],
      image: (card as any).image
    };

    return new Response(JSON.stringify(payload), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
    });
  } catch (e) {
    logError('Обработчик /api/initial завершился с ошибкой', e);
    return new Response(JSON.stringify({ error: 'ошибка_инициализации' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
