import { test, expect } from '@playwright/test';
import { mockCatalog } from './fixtures';

const creator = { id: 42, username: 'creator', email: 'creator@example.com', displayName: 'Creator', profileType: 'creator', bio: '', location: '', disciplines: [], avatar: '' };
async function signInFixture(page: import('@playwright/test').Page) {
  await page.addInitScript((user) => {
    if (!localStorage.getItem('underground_token')) {
      localStorage.setItem('underground_token', 'test-token');
      localStorage.setItem('underground_user', JSON.stringify(user));
    }
  }, creator);
}

test('private downloads survive reload, open offline, isolate accounts and can be removed', async ({ page, context }) => {
  await signInFixture(page); await mockCatalog(page);
  await page.route('**/works/5/download/', (route) => route.fulfill({ contentType: 'text/plain', body: 'A saved poem.', headers: { 'Access-Control-Allow-Origin': '*' } }));
  await page.goto('/');
  await page.getByRole('button', { name: 'View A Small Poem' }).click();
  await page.getByRole('button', { name: 'Save offline', exact: true }).click();
  await expect(page.getByText('Saved in Offline downloads.')).toBeVisible();
  await page.getByRole('button', { name: 'Close viewer' }).click();
  await page.goto('/downloads');
  await expect(page.locator('.offline-entry')).toHaveCount(1);
  await page.reload();
  await expect(page.locator('.offline-entry')).toHaveCount(1);
  await context.setOffline(true);
  await page.getByRole('button', { name: 'Open', exact: true }).click();
  await expect(page.locator('.text-preview')).toHaveText('A saved poem.');
  await page.getByRole('button', { name: 'Close viewer' }).click();
  await context.setOffline(false);
  await page.evaluate(() => localStorage.setItem('underground_user', JSON.stringify({ id: 99, profileType: 'listener' })));
  await page.reload();
  await expect(page.locator('.offline-entry')).toHaveCount(0);
  await page.evaluate((user) => localStorage.setItem('underground_user', JSON.stringify(user)), creator);
  await page.reload();
  await expect(page.locator('.offline-entry')).toHaveCount(1);
  await page.getByRole('button', { name: 'Remove', exact: true }).click();
  await expect(page.locator('.offline-entry')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('.offline-entry')).toHaveCount(0);
});

test('manage catalog paginates, reuses cache and refreshes explicitly', async ({ page }) => {
  await signInFixture(page);
  const requests: number[] = [];
  await page.route('**/works/mine/**', (route) => {
    const number = Number(new URL(route.request().url()).searchParams.get('page'));
    requests.push(number);
    return route.fulfill({ json: { works: [{ id: number, title: `Page ${number} work`, file: 'poem.txt', workType: 'poetry', description: '', thumbnail: '', published: true, isPayable: false, priceEtb: '0', playCount: 0, downloadCount: 0 }], page: number, pageSize: 20, total: 21, hasMore: number === 1 }, headers: { 'Access-Control-Allow-Origin': '*' } });
  });
  await page.goto('/my-creations');
  await expect(page.getByRole('heading', { name: 'Page 1 work' })).toBeVisible();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Page 2 work' })).toBeVisible();
  await page.getByRole('button', { name: 'Previous', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Page 1 work' })).toBeVisible();
  expect(requests).toEqual([1, 2]);
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await expect.poll(() => requests.length).toBe(3);
});

test('large raster images are resized before upload and transparent PNGs remain transparent', async ({ page }) => {
  await signInFixture(page);
  let upload: Buffer | null = null;
  await page.route('**/works/upload/', async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization,content-type', 'Access-Control-Allow-Methods': 'POST,OPTIONS' } }); return;
    }
    upload = route.request().postDataBuffer();
    await route.fulfill({ json: { id: 1 }, headers: { 'Access-Control-Allow-Origin': '*' } });
  });
  await mockCatalog(page);
  await page.goto('/publish');
  const original = await page.evaluate(async () => {
    const canvas = document.createElement('canvas'); canvas.width = 4000; canvas.height = 3000;
    const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#f00'; ctx.fillRect(0, 0, 2000, 3000);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  await page.getByLabel('Work title').fill('Compressed image');
  await page.getByLabel('Work type').selectOption('photography');
  await page.locator('input[type=file]').first().setInputFiles({ name: 'large.png', mimeType: 'image/png', buffer: Buffer.from(original, 'base64') });
  await page.getByRole('button', { name: 'Publish work', exact: true }).click();
  await expect.poll(() => upload !== null).toBeTruthy();
  const body = upload! as Buffer;
  const marker = Buffer.from('Content-Type: image/webp\r\n\r\n');
  const start = body.indexOf(marker) + marker.length;
  expect(start).toBeGreaterThan(marker.length);
  const end = body.indexOf(Buffer.from('\r\n--'), start);
  const compressed = body.subarray(start, end);
  expect(compressed.length).toBeLessThan(Buffer.from(original, 'base64').length);
  const dimensions = await page.evaluate(async (base64) => {
    const image = await createImageBitmap(await (await fetch(`data:image/webp;base64,${base64}`)).blob());
    const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
    const ctx = canvas.getContext('2d')!; ctx.drawImage(image, 0, 0);
    const alpha = ctx.getImageData(image.width - 1, 0, 1, 1).data[3];
    image.close(); return { width: canvas.width, height: canvas.height, alpha };
  }, compressed.toString('base64'));
  expect(dimensions).toEqual({ width: 2048, height: 1536, alpha: 0 });
});
