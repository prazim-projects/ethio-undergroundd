import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mockCatalog } from './fixtures';

async function contrastAudit(page: Page) {
  const result = await new AxeBuilder({ page }).withRules(['color-contrast']).analyze();
  expect(result.violations.map((violation) => ({ id: violation.id, elements: violation.nodes.map((node) => ({ target: node.target, reason: node.failureSummary })) }))).toEqual([]);
}
function contrast(foreground: string, background: string) {
  const luminance = (value: string) => {
    const channels = value.match(/[\d.]+/g)!.slice(0, 3).map(Number).map((channel) => {
      const v = channel / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    });
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  };
  const [a, b] = [luminance(foreground), luminance(background)].sort((x, y) => y - x);
  return (a + 0.05) / (b + 0.05);
}

for (const theme of ['light', 'dark', 'abyssinia']) {
  test(`${theme}: readable catalog, player, previews, forms, errors and saved preference`, async ({ page }, info) => {
    await mockCatalog(page);
    await page.route('**/auth/sign-in/', (route) => route.fulfill({ status: route.request().method() === 'OPTIONS' ? 204 : 400, json: { error: 'Please check your sign-in details.' }, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' } }));
    await page.goto('/');
    await page.getByRole('combobox', { name: 'Color theme' }).selectOption(theme);
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    await expect(page.getByRole('heading', { name: 'In rotation' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    await contrastAudit(page);
    if (theme === 'abyssinia') {
      await expect(page.locator('.abyssinia-hero__art')).toBeVisible();
      await expect(page.locator('.abyssinia-hero__art')).toHaveJSProperty('naturalWidth', 2172);
      const navigation = page.locator(info.project.name === 'mobile' ? '.mobile-nav' : '.sidebar nav');
      await expect(navigation.locator('.abyssinia-portrait')).toHaveCount(6);
    }
    await page.screenshot({ path: `../../.tmp/themes/${info.project.name}-${theme}-catalog.png`, fullPage: true });
    await page.getByRole('button', { name: 'Play Midnight in Addis', exact: true }).first().click();
    await expect(page.getByRole('button', { name: 'Pause playback' })).toBeVisible();
    if (info.project.name === 'mobile') {
      const player = (await page.locator('.music-player').boundingBox())!;
      const nav = (await page.locator('.mobile-nav').boundingBox())!;
      expect(player.y + player.height).toBeLessThanOrEqual(nav.y + 1);
    }
    await contrastAudit(page);
    await page.getByRole('button', { name: 'View A Small Poem' }).click();
    await expect(page.locator('.text-preview')).toContainText('<script>');
    await contrastAudit(page);
    await page.getByRole('button', { name: 'Close viewer' }).click();
    await page.goto('/profile');
    await expect(page.getByRole('combobox', { name: 'Color theme' })).toHaveValue(theme);
    await page.getByRole('textbox', { name: 'Username or email' }).fill('creator');
    await page.getByLabel('Password', { exact: true }).fill('password123');
    await page.getByRole('button', { name: 'Sign in', exact: true }).last().click();
    await expect(page.getByText('Please check your sign-in details.')).toBeVisible();
    await contrastAudit(page);
    await page.screenshot({ path: `../../.tmp/themes/${info.project.name}-${theme}-form.png`, fullPage: true });
    const placeholder = await page.getByRole('textbox', { name: 'Username or email' }).evaluate((input) => ({
      color: getComputedStyle(input, '::placeholder').color, background: getComputedStyle(input).backgroundColor,
      text: getComputedStyle(input).color,
    }));
    expect(contrast(placeholder.color, placeholder.background)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(placeholder.text, placeholder.background)).toBeGreaterThanOrEqual(4.5);
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
  });
  test(`${theme}: creator forms, catalog settings and offline notices have readable text`, async ({ page }) => {
    await page.addInitScript((palette) => {
      localStorage.setItem('underground_theme', palette);
      localStorage.setItem('underground_token', 'theme-creator');
      localStorage.setItem('underground_user', JSON.stringify({ id: 42, username: 'creator', displayName: 'Addis Creator', profileType: 'creator', bio: '', location: 'Addis Ababa', disciplines: ['music'], avatar: '' }));
    }, theme);
    await page.route('**/works/mine/**', (route) => route.fulfill({ json: {
      works: [{ id: 1, title: 'A creative work', file: 'song.mp3', workType: 'music', description: 'Independent sounds.', thumbnail: '', published: true, isPayable: true, priceEtb: '100', playCount: 42, downloadCount: 12 }], page: 1, pageSize: 20, total: 1, hasMore: false,
    }, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization' } }));
    await page.goto('/publish');
    await expect(page.getByLabel('Work title')).toBeVisible();
    await page.getByRole('checkbox', { name: 'Make this work payable through Telebirr' }).check();
    await contrastAudit(page);
    await page.goto('/profile');
    await expect(page.getByRole('textbox', { name: 'Display name' })).toHaveValue('Addis Creator');
    await contrastAudit(page);
    await page.goto('/my-creations');
    await page.getByRole('button', { name: /A creative work/ }).click();
    await expect(page.getByRole('button', { name: 'Save changes' })).toBeVisible();
    await contrastAudit(page);
    await page.goto('/downloads');
    await expect(page.getByText('Open a work and choose Save offline to keep it here.')).toBeVisible();
    await page.evaluate(() => { Object.defineProperty(navigator, 'onLine', { value: false, configurable: true }); window.dispatchEvent(new Event('offline')); });
    await expect(page.getByText('You are offline. Open Offline downloads to play saved works.')).toBeVisible();
    await contrastAudit(page);
  });
}

test('stored invalid themes and unavailable browser storage keep the app usable', async ({ page }) => {
  await mockCatalog(page);
  await page.addInitScript(() => localStorage.setItem('underground_theme', 'unknown-theme'));
  await page.goto('/');
  await expect(page.getByRole('combobox', { name: 'Color theme' })).toHaveValue('light');
  await page.evaluate(() => { Storage.prototype.setItem = () => { throw new DOMException('Storage unavailable'); }; });
  await page.getByRole('combobox', { name: 'Color theme' }).selectOption('abyssinia');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'abyssinia');
  await expect(page.getByRole('heading', { name: 'Ancient soul. Future frequency.' })).toBeVisible();
});

test('shared release links use the public frontend instead of the native or preview origin', async ({ page, context }) => {
  await mockCatalog(page);
  const apiRequests: string[] = [];
  page.on('request', (request) => { if (request.url().endsWith('/graphql/')) apiRequests.push(request.url()); });
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.addInitScript(() => Object.defineProperty(navigator, 'share', { value: undefined, configurable: true }));
  await page.goto('/');
  await page.getByRole('button', { name: 'Share Midnight in Addis' }).click();
  expect(apiRequests).toContain('https://prasim.pythonanywhere.com/graphql/');
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe('https://ethio-underground.vercel.app/works/work-1');
});
