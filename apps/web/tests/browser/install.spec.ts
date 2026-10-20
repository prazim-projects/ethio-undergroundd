import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mockCatalog } from './fixtures';

test('Get app is discoverable even when the browser has not offered an install prompt', async ({ page }) => {
  await mockCatalog(page); await page.goto('/');
  await page.getByRole('link', { name: 'Get app', exact: true }).click();
  await expect(page).toHaveURL(/\/install$/);
  await expect(page.getByRole('heading', { name: 'Install the web app.' })).toBeVisible();
  await page.getByRole('button', { name: 'Show installation steps' }).click();
  await expect(page.getByRole('status')).toContainText('Follow the steps below');
  await expect(page.getByRole('heading', { name: 'iPhone & iPad · Safari' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Android · Chrome' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Download Android preview/ })).toHaveAttribute('href', 'https://ethio-underground.vercel.app/downloads/ethio-underground.apk');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
});

test('the browser install event survives navigation and the installed event updates the page', async ({ page }) => {
  await mockCatalog(page); await page.goto('/');
  await page.evaluate(() => {
    (window as any).installCalls = 0;
    const event = new Event('beforeinstallprompt', { cancelable: true });
    Object.assign(event, { prompt: async () => { (window as any).installCalls++; }, userChoice: Promise.resolve({ outcome: 'accepted' }) });
    window.dispatchEvent(event);
  });
  await page.getByRole('link', { name: 'Get app', exact: true }).click();
  await page.getByRole('button', { name: 'Install web app', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as any).installCalls)).toBe(1);
  await page.evaluate(() => window.dispatchEvent(new Event('appinstalled')));
  await expect(page.getByText('Already running as an installed app.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Install web app', exact: true })).toHaveCount(0);
});

test('dismissed installation remains retryable through manual steps', async ({ page }) => {
  await page.goto('/install');
  await page.evaluate(() => {
    const event = new Event('beforeinstallprompt', { cancelable: true });
    Object.assign(event, { prompt: async () => {}, userChoice: Promise.resolve({ outcome: 'dismissed' }) });
    window.dispatchEvent(event);
  });
  await page.getByRole('button', { name: 'Install web app', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Installation dismissed');
  await expect(page.getByRole('button', { name: 'Show installation steps' })).toBeEnabled();
});

test('the installation page remains accessible and readable in every theme', async ({ page }) => {
  await page.goto('/install');
  for (const theme of ['light', 'dark', 'abyssinia']) {
    await page.getByRole('combobox', { name: 'Color theme' }).selectOption(theme);
    const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(result.violations.map((v) => ({ id: v.id, targets: v.nodes.map((node) => node.target) }))).toEqual([]);
  }
});

test('the published Android download is an APK ZIP rather than the SPA fallback', async ({ request }) => {
  const response = await request.get('/downloads/ethio-underground.apk');
  expect(response.ok()).toBeTruthy();
  const apk = await response.body();
  expect(apk.length).toBeGreaterThan(1_000_000);
  expect(apk.subarray(0, 4).toString('hex')).toBe('504b0304');
  expect(apk.includes(Buffer.from('AndroidManifest.xml'))).toBeTruthy();
});
