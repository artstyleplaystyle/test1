import type { PageServerLoad } from './$types';
import { getLastCardAsync, fetchAndCacheNext } from '$lib/server/cache';
import type { CoffeeType } from '$lib/types';
import { log, error as logError } from '$lib/server/logger';

export const load: PageServerLoad = async ({ fetch, url }) => {
  try {
    const t = (url.searchParams.get('type') === 'iced' ? 'iced' : 'hot') as CoffeeType;
    let card = await getLastCardAsync(t);
    if (!card) {
      log(`SSR: кеш пуст (${t}), загружаем начальную карточку`);
      card = await fetchAndCacheNext(fetch, t);
    }
    return { initial: card, type: t };
  } catch (e) {
    logError('SSR load завершился с ошибкой', e);
    return { initial: null, type: 'hot' };
  }
};
