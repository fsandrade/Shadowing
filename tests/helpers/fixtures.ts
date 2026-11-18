import { test as base, type Page as PlaywrightPage } from '@playwright/test';

export const test = base;

export { expect, type Page } from '@playwright/test';

export const E2E_LEVEL = 'B1';

export type ActivityChoice = 'speaking' | 'dictation';
export type SourceChoice = 'catalog' | 'custom';

export interface GotoOptions {
  /** null skips seeding a level, so the app opens on onboarding. */
  level?: string | null;
  /** null stops on the chooser instead of starting anything. */
  activity?: ActivityChoice | null;
  /** Defaults to the catalog (topic) source. */
  source?: SourceChoice;
  topic?: string | null;
  minutes?: number;
}

export interface StartOptions {
  source?: SourceChoice;
  topic?: string | null;
  minutes?: number;
}

export async function gotoApp(
  page: PlaywrightPage,
  opts: GotoOptions = {},
): Promise<void> {
  const level = opts.level === undefined ? E2E_LEVEL : opts.level;
  const activity = opts.activity === undefined ? 'speaking' : opts.activity;

  await page.addInitScript((chosen) => {
    if (chosen === null) { return; }
    localStorage.setItem('shadowing.profile', JSON.stringify({ levelId: chosen }));
  }, level);

  await page.goto('/');

  if (level === null) {
    await page.locator('#levels').waitFor();
    return;
  }

  await page.locator('#activities').waitFor();

  if (activity === null) {
    return;
  }

  if (opts.source === 'custom') {
    throw new Error(
      'gotoApp: custom sessions need content pasted into the chooser first - '
      + 'seed it in the spec (see startCustomText), then startActivity.',
    );
  }

  await startActivity(page, activity, {
    source: opts.source,
    topic: opts.topic ?? null,
    minutes: opts.minutes ?? 15,
  });
}

async function waitForScreen(page: PlaywrightPage): Promise<void> {
  await page.locator('#startActivity').waitFor({ state: 'detached' });
}

async function waitForScreenContent(page: PlaywrightPage, kind: ActivityChoice): Promise<void> {
  if (kind === 'dictation') {
    await page.locator('#dictInput').waitFor({ state: 'visible' });
  } else {
    await page.locator('.lines p').first().waitFor({ state: 'attached' });
  }
}

/** Drives the chooser from a chosen kind and source through to the screen. */
export async function startActivity(
  page: PlaywrightPage,
  kind: ActivityChoice,
  opts: StartOptions = {},
): Promise<void> {
  const source = opts.source ?? 'catalog';
  const topic = opts.topic ?? null;
  const minutes = opts.minutes ?? 15;

  await page.locator(`[data-kind-id="${kind}"]`).click();

  await page.locator(source === 'catalog' ? '#srcCatalog' : '#srcCustom').click();

  if (source === 'catalog') {
    await page.locator(topic === null ? '#allTopics' : `[data-deck-id="${topic}"]`).click();
  }

  await page.locator(`.durations [data-min="${minutes}"]`).click();
  await page.locator('#startActivity').click();

  await waitForScreen(page);
  await waitForScreenContent(page, kind);
}

/**
 * Seeds a My-text session end to end: pick the kind on the chooser, paste the
 * text into the custom editor, and start. The practice screen keeps the editor
 * open (see practice.html), so later edits still work in the same session.
 */
export async function startCustomText(
  page: PlaywrightPage,
  kind: ActivityChoice,
  text: string,
  minutes = 15,
): Promise<void> {
  await page.locator(`[data-kind-id="${kind}"]`).click();
  await page.locator('#srcCustom').click();
  await page.locator('#customText').fill(text);
  await page.locator('#customSave').click();
  await startActivity(page, kind, { source: 'custom', minutes });
}
