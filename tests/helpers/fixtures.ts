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

export type ActivityChoice =
  | 'listening' | 'shadowing' | 'speaking' | 'spelling' | 'custom';

export interface GotoOptions {
  /** null skips seeding a level, so the app opens on onboarding. */
  level?: string | null;
  /** null stops on the chooser instead of starting anything. */
  activity?: ActivityChoice | null;
  topic?: string | null;
  minutes?: number;
}

// Shadowing is the default because it is the only ladder activity that scores
// nothing and still leaves the text visible, so it is the closest thing to the
// screen every older assertion was written against.
export async function gotoApp(
  page: PlaywrightPage,
  opts: GotoOptions = {},
): Promise<void> {
  const level = opts.level === undefined ? E2E_LEVEL : opts.level;
  const activity = opts.activity === undefined ? 'shadowing' : opts.activity;

  await page.addInitScript((chosen) => {
    if (chosen === null) { return; }
    localStorage.setItem('shadowing.profile', JSON.stringify({ levelId: chosen }));
  }, level);

  await page.goto('/');

  if (level === null) {
    await page.locator('#levels').waitFor();
    return;
  }

  await page.waitForFunction(
    () => (window as unknown as Record<string, unknown>)['__shadowing'] !== undefined,
  );

  if (activity === null) {
    await page.locator('#activities').waitFor();
    return;
  }

  await startActivity(page, activity, opts.topic ?? null, opts.minutes ?? 15);
}

/** Drives the chooser from a chosen activity through to the practice screen. */
export async function startActivity(
  page: PlaywrightPage,
  activity: ActivityChoice,
  topic: string | null = null,
  minutes = 15,
): Promise<void> {
  await page.locator(`[data-activity-id="${activity}"]`).click();
  if (activity !== 'custom') {
    await page.locator(topic === null ? '#allTopics' : `[data-deck-id="${topic}"]`).click();
  }
  await page.locator(`.durations [data-min="${minutes}"]`).click();
  await page.locator('#startActivity').click();

  await page.waitForFunction(() => {
    const bridge = (window as unknown as Record<string, { state: { screen: string } }>)['__shadowing'];
    return bridge?.state.screen === 'practice';
  });

  // The debug bridge reads signals, which flip before Angular re-renders the
  // switch. Interactions aimed at the practice screen must wait out that gap
  // or they land on the still-mounted chooser and vanish.
  await page.locator('#startActivity').waitFor({ state: 'detached' });
  if (activity !== 'custom') {
    await page.locator('.lines p').first().waitFor({ state: 'attached' });
  }
}
