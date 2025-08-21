import { test, expect } from '@playwright/test';
import type { Page, APIRequestContext } from '@playwright/test';

test.beforeEach(async ({ page }: { page: Page }) => {
  await page.goto('/');
});

test('SSR: на странице сразу одна карточка', async ({ page }: { page: Page }) => {
  await expect(page.locator('.list .item')).toHaveCount(1);
  await expect(page.locator('.item .title')).toBeVisible();
  
  const badge = page.locator('.item .image .intensifier').first();
  await expect(badge).toBeVisible();
  await expect(badge).not.toHaveText('');
});

test('кнопка добавляет карточку и блокируется во время загрузки', async ({ page }: { page: Page }) => {
  const btn = page.getByRole('button', { name: 'Добавить карточку' });
  await expect(btn).toBeEnabled();
  await btn.click();
  await expect(btn).toBeDisabled();
  await expect(page.locator('.list .item')).toHaveCount(2, { timeout: 15000 });
  await expect(btn).toBeEnabled();
});

async function assertApiShape(ctx: APIRequestContext, method: 'GET' | 'POST', url: string) {
  const res = method === 'GET' ? await ctx.get(url) : await ctx.post(url);
  expect(res.ok()).toBeTruthy();
  const j = await res.json();
  expect(typeof j.id).toBe('number');
  expect(typeof j.title).toBe('string');
  expect(typeof j.description).toBe('string');
  expect(Array.isArray(j.ingredients)).toBeTruthy();
  expect(typeof j.image).toBe('string');
  expect(j.image.length).toBeGreaterThan(0);
}

test('initial и next (hot и iced)', async ({ request }) => {
  await assertApiShape(request, 'GET', '/api/initial?type=hot');
  await assertApiShape(request, 'POST', '/api/next?type=hot');
  await assertApiShape(request, 'GET', '/api/initial?type=iced');
  await assertApiShape(request, 'POST', '/api/next?type=iced');
});

// Кеш: после POST /api/next тот же id должен вернуться из /api/initial
async function getJson(ctx: APIRequestContext, method: 'GET' | 'POST', url: string) {
  const res = method === 'GET' ? await ctx.get(url) : await ctx.post(url);
  expect(res.ok()).toBeTruthy();
  return res.json();
}

test('кеш возвращает последнюю карточку: hot', async ({ request }) => {
  const next = await getJson(request, 'POST', '/api/next?type=hot');
  const init = await getJson(request, 'GET', '/api/initial?type=hot');
  expect(init.id).toBe(next.id);
});

test('кеш возвращает последнюю карточку: iced', async ({ request }) => {
  const next = await getJson(request, 'POST', '/api/next?type=iced');
  const init = await getJson(request, 'GET', '/api/initial?type=iced');
  expect(init.id).toBe(next.id);
});
