import { test as base, type Page as PlaywrightPage } from '@playwright/test';
import { installFakeSupabase } from './fake-supabase';

export const test = base.extend({
  page: async ({ page }, use) => {
    await installFakeSupabase(page);
    await use(page);
  },
});

export { expect, type Page } from '@playwright/test';

export const E2E_LEVEL = 'B1';

export async function gotoApp(
  page: PlaywrightPage,
  opts: { level?: string | null } = {},
): Promise<void> {
  const level = opts.level === undefined ? E2E_LEVEL : opts.level;

  await page.addInitScript((chosen) => {
    if (chosen === null) { return; }
    const key = 'shadowing.settings';
    const existing = JSON.parse(localStorage.getItem(key) ?? '{}');
    localStorage.setItem(key, JSON.stringify({ ...existing, levelId: chosen }));
  }, level);

  await page.goto('/');

  if (level === null) {
    await page.locator('#levels').waitFor();
    return;
  }
  await page.waitForFunction(
    () => (window as unknown as Record<string, unknown>)['__shadowing'] !== undefined,
  );
}
