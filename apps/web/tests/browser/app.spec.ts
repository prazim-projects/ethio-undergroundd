import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mockCatalog } from './fixtures';

test('UI: responsive catalog, artwork and accessible controls', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await mockCatalog(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'In rotation' })).toBeVisible();
  await expect(page.locator('.track-row')).toHaveCount(6);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  if (await page.locator('.sidebar').isVisible()) {
    const sidebar = (await page.locator('.sidebar').boundingBox())!;
    const heading = (await page.getByRole('heading', { level: 1 }).boundingBox())!;
    expect(heading.x).toBeGreaterThanOrEqual(sidebar.x + sidebar.width);
  }
  const audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(audit.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(', ')}`)).toEqual([]);
  await page.screenshot({ path: `../../.tmp/audit/${info.project.name}-catalog.png`, fullPage: true });
  expect(errors).toEqual([]);
});

test('Logic: actual audio start counts once, resume does not double count', async ({ page }, info) => {
  const counts = await mockCatalog(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Play Midnight in Addis', exact: true }).first().click();
  await expect.poll(() => counts.get('1')).toBe(1);
  await expect(page.locator('[data-work-id="1"] .track-count')).toContainText('11');
  await page.getByRole('button', { name: 'Pause playback' }).click();
  await page.getByRole('button', { name: 'Resume playback' }).click();
  await expect(page.getByRole('button', { name: 'Pause playback' })).toBeVisible();
  expect(counts.get('1')).toBe(1);
  await page.getByRole('button', { name: 'Next track', exact: true }).click();
  await expect.poll(() => counts.get('2')).toBe(1);
  await page.screenshot({ path: `../../.tmp/audit/${info.project.name}-player.png` });
  const player = await page.locator('.music-player').boundingBox();
  const nav = await page.locator('.mobile-nav').isVisible() ? await page.locator('.mobile-nav').boundingBox() : null;
  if (player && nav) expect(player.y + player.height).toBeLessThanOrEqual(nav.y + 2);
});

test('Logic/security: inline text is escaped and views update in the dialog and list', async ({ page }) => {
  const counts = await mockCatalog(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'View A Small Poem' }).click();
  await expect(page.locator('.viewer-dialog .text-preview')).toContainText('<script>');
  await expect.poll(() => counts.get('5')).toBe(1);
  await expect(page.locator('.viewer-credit')).toContainText('11 views');
  expect(await page.evaluate(() => (window as any).previewInjected)).toBeUndefined();
  await page.getByRole('button', { name: 'Close viewer' }).click();
  await expect(page.locator('[data-work-id="5"] .track-count')).toContainText('11');
});

test('UI: visual-art PDF uses document stream and modal restores focus', async ({ page }) => {
  await mockCatalog(page); await page.goto('/');
  const opener = page.getByRole('button', { name: 'View Visual Art Portfolio' });
  await opener.click();
  await expect(page.locator('.viewer-dialog iframe')).toHaveAttribute('src', /\/works\/6\/stream\/$/);
  await expect(page.locator('.viewer-dialog iframe')).toBeVisible();
  await page.getByRole('button', { name: 'Close viewer' }).click();
  await expect(opener).toBeFocused();
});

test('Logic: search, filters, shared links and history work', async ({ page }) => {
  await mockCatalog(page); await page.goto('/');
  await page.getByRole('textbox', { name: 'Search music and creators' }).fill('Bati');
  await page.getByRole('button', { name: 'Submit search' }).click();
  await expect(page.locator('.track-row')).toHaveCount(1);
  await expect(page.locator('.track-title')).toHaveText('Bati After Hours');
  await page.goto('/works/work-6');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Visual Art Portfolio');
  await page.goto('/?type=poetry');
  await expect(page.locator('.track-row')).toHaveCount(1);
  await expect(page.locator('.track-title')).toHaveText('A Small Poem');
  await page.goBack();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Visual Art Portfolio');
});

test('UI/security: corrupt stored session does not crash sign-in', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('underground_user', '{broken'));
  await page.goto('/profile');
  await expect(page.getByRole('textbox', { name: 'Username or email' })).toBeVisible();
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await page.getByLabel('Password', { exact: true }).fill('password123');
  await page.getByLabel('Confirm password', { exact: true }).fill('different123');
  await expect(page.locator('button[type="submit"]', { hasText: 'Create account' })).toBeDisabled();
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(result.violations.map((v) => v.id)).toEqual([]);
});

test('UI: network error has a functioning retry', async ({ page }) => {
  await page.route('**/graphql/', (route) => route.abort()); await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Could not load the catalog' })).toBeVisible();
  await page.unroute('**/graphql/'); await mockCatalog(page);
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.locator('.track-row')).toHaveCount(6);
});

test('Performance: cold local catalog readiness under 4s and layout shift under 0.1', async ({ page }, info) => {
  await mockCatalog(page);
  await page.addInitScript(() => {
    (window as any).auditCLS = 0;
    new PerformanceObserver((list) => { for (const entry of list.getEntries() as any[]) if (!entry.hadRecentInput) (window as any).auditCLS += entry.value; }).observe({ type: 'layout-shift', buffered: true });
  });
  const start = Date.now(); await page.goto('/'); await expect(page.locator('.track-row')).toHaveCount(6);
  const readyMs = Date.now() - start;
  const metrics = await page.evaluate(() => ({ cls: (window as any).auditCLS, fcp: performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? null }));
  await info.attach('performance', { body: JSON.stringify({ readyMs, ...metrics, scope: 'local production build, mocked API, no throttling' }), contentType: 'application/json' });
  expect(readyMs).toBeLessThan(4000); expect(metrics.cls).toBeLessThan(0.1);
});

test('PWA: installed shell reloads offline and never caches API responses', async ({ browser }, info) => {
  const context = await browser.newContext({ baseURL: 'http://127.0.0.1:4173', serviceWorkers: 'allow', viewport: info.project.use.viewport });
  const page = await context.newPage();
  await mockCatalog(page); await page.goto('http://127.0.0.1:4173/');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBeTruthy();
  const manifest = await (await page.request.get('/manifest.webmanifest')).json();
  expect(manifest.display).toBe('standalone');
  expect(manifest.icons.map((icon: any) => icon.sizes)).toEqual(expect.arrayContaining(['192x192', '512x512']));
  for (const icon of manifest.icons) expect((await page.request.get(icon.src)).ok()).toBeTruthy();
  await context.setOffline(true);
  await page.goto('http://127.0.0.1:4173/search');
  await expect(page.getByRole('heading', { name: 'Dig a little deeper.' })).toBeVisible();
  await expect(page.getByText('You are offline. Open Offline downloads to play saved works.')).toBeVisible();
  const cached = await page.evaluate(async () => (await Promise.all((await caches.keys()).map(async (name) => (await (await caches.open(name)).keys()).map((request) => request.url)))).flat());
  expect(cached.filter((url) => /\/graphql|\/auth\/|\/media\/|\/works\/\d+/.test(url))).toEqual([]);
  await context.close();
});
