import type { RequestHandler } from '@sveltejs/kit';
import type { CoffeeType } from '$lib/types';
import { fetchAndCacheNext } from '$lib/server/cache';

export const POST: RequestHandler = async ({ fetch, url }) => {
  const t = (url.searchParams.get('type') === 'iced' ? 'iced' : 'hot') as CoffeeType;
  const card = await fetchAndCacheNext(fetch, t);
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
};
