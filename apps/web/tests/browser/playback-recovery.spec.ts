import { test, expect } from '@playwright/test';
import { mockCatalog } from './fixtures';

const user = { id: 42, username: 'creator', email: 'creator@example.com', displayName: 'Creator', profileType: 'creator', bio: '', location: '', disciplines: [], avatar: '/media/avatars/portrait.png' };
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWQAAAABJRU5ErkJggg==', 'base64');

test('reload restores track, queue and paused position without recounting a play', async ({ page }) => {
  const counts = await mockCatalog(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Play Midnight in Addis', exact: true }).first().click();
  await expect(page.getByRole('button', { name: 'Pause playback' })).toBeVisible();
  await page.locator('audio').evaluate((element: HTMLAudioElement) => { element.currentTime = 7; });
  await page.getByRole('button', { name: 'Pause playback' }).click();
  await expect.poll(() => page.locator('audio').evaluate((element: HTMLAudioElement) => element.currentTime)).toBeGreaterThanOrEqual(6.8);
  await page.reload();
  await expect(page.locator('.music-player strong').first()).toHaveText('Midnight in Addis');
  await expect.poll(() => page.locator('audio').evaluate((element: HTMLAudioElement) => element.currentTime)).toBeGreaterThanOrEqual(6.8);
  await expect(page.getByRole('button', { name: 'Resume playback' })).toBeVisible();
  expect(counts.get('1')).toBe(1);
  await page.getByRole('button', { name: 'Next track' }).click();
  await expect(page.locator('.music-player strong').first()).toHaveText('Bati After Hours');
});

test('profile navigation uses the uploaded avatar and catalog survives a reload without another query', async ({ page }) => {
  await page.addInitScript((value) => {
    localStorage.setItem('underground_token', 'picture-token'); localStorage.setItem('underground_user', JSON.stringify(value));
  }, user);
  await mockCatalog(page);
  let queries = 0;
  page.on('request', (request) => { if (request.url().endsWith('/graphql/')) queries++; });
  await page.route('**/images/avatars/portrait.png', (route) => route.fulfill({ contentType: 'image/png', body: png }));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'In rotation' })).toBeVisible();
  await expect(page.locator('.account-link .user-avatar img')).toHaveJSProperty('naturalWidth', 1);
  await expect(page.locator('.mobile-nav a[href="/profile"] .user-avatar img')).toHaveCount(1);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'In rotation' })).toBeVisible();
  expect(queries).toBe(1);
  await page.getByRole('button', { name: 'Play Midnight in Addis', exact: true }).first().click();
  await expect(page.getByRole('button', { name: 'Pause playback' })).toBeVisible();
  if (await page.locator('.mobile-nav').isVisible()) {
    const player = (await page.locator('.music-player').boundingBox())!;
    const navigation = (await page.locator('.mobile-nav').boundingBox())!;
    expect(player.y + player.height).toBeLessThanOrEqual(navigation.y + 1);
  }
});

test('an actively playing song recovers its position after refresh', async ({ page }) => {
  await mockCatalog(page); await page.goto('/');
  await page.getByRole('button', { name: 'Play Midnight in Addis', exact: true }).first().click();
  await expect(page.getByRole('button', { name: 'Pause playback' })).toBeVisible();
  await page.locator('audio').evaluate((element: HTMLAudioElement) => { element.currentTime = 9; });
  await expect.poll(() => page.locator('audio').evaluate((element: HTMLAudioElement) => element.currentTime)).toBeGreaterThanOrEqual(8.8);
  await page.reload();
  await expect(page.locator('.music-player strong').first()).toHaveText('Midnight in Addis');
  await expect.poll(() => page.locator('audio').evaluate((element: HTMLAudioElement) => element.currentTime)).toBeGreaterThanOrEqual(8.8);
  // Autoplay policy may require a user gesture after a full document reload.
  await expect(page.locator('.music-player').getByRole('button', { name: /Pause playback|Resume playback/ })).toBeVisible();
});

test('creator can replace artwork using a multipart edit', async ({ page }) => {
  await page.addInitScript((value) => {
    localStorage.setItem('underground_token', 'artwork-token'); localStorage.setItem('underground_user', JSON.stringify(value));
  }, user);
  const work = { id: 1, title: 'Artwork song', file: 'song.mp3', workType: 'music', description: '', thumbnail: '', published: true, isPayable: false, priceEtb: '0', playCount: 0, downloadCount: 0 };
  await page.route('**/works/mine/**', (route) => route.fulfill({ json: { works: [work], page: 1, total: 1, hasMore: false }, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization' } }));
  let body = '';
  await page.route('**/works/1/settings/', (route) => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization,idempotency-key,content-type', 'Access-Control-Allow-Methods': 'POST' } });
    body = route.request().postDataBuffer()!.toString('latin1');
    return route.fulfill({ json: { work: { ...work, thumbnail: '/media/work-thumbnails/cover.png' } }, headers: { 'Access-Control-Allow-Origin': '*' } });
  });
  await page.goto('/my-creations');
  await page.getByRole('button', { name: /Artwork song/ }).click();
  const cover = await page.evaluate(() => { const canvas = document.createElement('canvas'); canvas.width = canvas.height = 16; canvas.getContext('2d')!.fillRect(0, 0, 16, 16); return canvas.toDataURL('image/png').split(',')[1]; });
  await page.getByLabel('Replace artwork').setInputFiles({ name: 'cover.png', mimeType: 'image/png', buffer: Buffer.from(cover, 'base64') });
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('Creation settings updated.')).toBeVisible();
  expect(body).toContain('name="thumbnail"');
  expect(body).toContain('cover.png');
});

test('popup errors expire after 2.5 seconds', async ({ page }) => {
  await mockCatalog(page);
  await page.route('**/works/1/play/', (route) => route.fulfill({ status: 503, json: { error: 'Unavailable' }, headers: { 'Access-Control-Allow-Origin': '*' } }));
  await page.goto('/');
  await page.getByRole('button', { name: 'Play Midnight in Addis', exact: true }).first().click();
  await expect(page.locator('.app-toast')).toBeVisible();
  await expect(page.locator('.app-toast')).toHaveCount(0, { timeout: 3500 });
});
