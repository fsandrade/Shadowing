import { test, expect, Page } from '@playwright/test';
import { installFakeAudio } from './helpers/fake-audio';

const APP_URL = '/';

const PAYLOAD = [
  '<script>window.__xssRan = true;</script>First sentence here.',
  '<img src=x onerror="window.__xssImg = true">Second one, with a payload.',
  '<b>Bold</b> markup and a <a href="javascript:window.__xssLink=true">link</a> third.',
  'Mr. Smith paid $3.50, so this stays one sentence.',
].join(' ');

async function openCustomTopic(page: Page): Promise<void> {
  await page.locator('button[data-deck-id="custom"]').click();
  await expect(page.locator('.custom-topic')).toBeVisible();
}

async function useText(page: Page, text: string): Promise<void> {
  await page.locator('#customText').fill(text);
  await page.locator('#customSave').click();
}

test('splits pasted text into practice lines', async ({ page }) => {
  installFakeAudio(page);
  await page.goto(APP_URL);
  await openCustomTopic(page);

  await expect(page.locator('#customSave')).toBeDisabled();

  await useText(page, 'First one. Second one! Third one?');

  await expect(page.locator('.lines p')).toHaveCount(3);
  await expect(page.locator('.lines p .text').first()).toHaveText('First one.');
  await expect(page.locator('.lines p .num').last()).toHaveText('3');
  await expect(page.locator('#customText')).toHaveCount(0);
  await expect(page.locator('.custom-summary')).toContainText('3 sentences');
});

test('neutralises markup and scripts in pasted text', async ({ page }) => {
  installFakeAudio(page);
  await page.goto(APP_URL);
  await openCustomTopic(page);
  await useText(page, PAYLOAD);

  await expect(page.locator('.lines p')).toHaveCount(4);
  await expect(page.locator('.lines img')).toHaveCount(0);
  await expect(page.locator('.lines b')).toHaveCount(0);
  await expect(page.locator('.lines a')).toHaveCount(0);

  const flags = await page.evaluate(() => ({
    script: !!(window as any).__xssRan,
    img: !!(window as any).__xssImg,
    link: !!(window as any).__xssLink,
  }));
  expect(flags).toEqual({ script: false, img: false, link: false });

  await expect(page.locator('.lines p .text').nth(2)).toHaveText('Bold markup and a link third.');
  await expect(page.locator('.lines p .text').nth(3))
    .toHaveText('Mr. Smith paid $3.50, so this stays one sentence.');
});

test('keeps ampersands and angle brackets the learner typed', async ({ page }) => {
  installFakeAudio(page);
  await page.goto(APP_URL);
  await openCustomTopic(page);
  await useText(page, 'R&D found that 5 < 10 and 20 > 3 in the report.');

  await expect(page.locator('.lines p .text').first())
    .toHaveText('R&D found that 5 < 10 and 20 > 3 in the report.');
});

test('remembers the text and the topic across a reload', async ({ page }) => {
  installFakeAudio(page);
  await page.goto(APP_URL);
  await openCustomTopic(page);
  await useText(page, 'Kept after reload. And a second one.');

  await page.reload();

  await expect(page.locator('button[data-deck-id="custom"]')).toHaveAttribute('aria-current', 'true');
  await expect(page.locator('.lines p')).toHaveCount(2);
  await expect(page.locator('.lines p .text').first()).toHaveText('Kept after reload.');
});

test('sanitises text that was written straight into storage', async ({ page }) => {
  installFakeAudio(page);
  await page.goto(APP_URL);
  await openCustomTopic(page);
  await useText(page, 'Placeholder text.');

  await page.evaluate(() => {
    localStorage.setItem(
      'shadowing.customTopic',
      JSON.stringify('<img src=x onerror="window.__tampered = true">Tampered one. And two.'),
    );
  });
  await page.reload();

  await expect(page.locator('.lines p')).toHaveCount(2);
  await expect(page.locator('.lines img')).toHaveCount(0);
  await expect(page.locator('.lines p .text').first()).toHaveText('Tampered one.');
  expect(await page.evaluate(() => !!(window as any).__tampered)).toBe(false);
});

test('editing and clearing the text', async ({ page }) => {
  installFakeAudio(page);
  await page.goto(APP_URL);
  await openCustomTopic(page);
  await useText(page, 'Original one. Original two.');

  await page.locator('#customEdit').click();
  await expect(page.locator('#customText')).toHaveValue('Original one. Original two.');

  await page.locator('#customText').fill('Replaced entirely.');
  await page.locator('#customCancel').click();
  await expect(page.locator('.lines p')).toHaveCount(2);

  await page.locator('#customClear').click();
  await expect(page.locator('.lines p')).toHaveCount(0);
  await expect(page.locator('#customText')).toBeVisible();
});

test('speaks a custom sentence exactly as written', async ({ page }) => {
  installFakeAudio(page);
  await page.goto(APP_URL);
  await openCustomTopic(page);
  await useText(page, 'This first sentence is long enough to measure. A second one follows.');

  await page.locator('#play').click();

  await expect
    .poll(() => page.evaluate(() => (window as any).__spokenText as string[]), { timeout: 15_000 })
    .toContain('This first sentence is long enough to measure.');
});

test('speaks angle brackets that tag stripping would have swallowed', async ({ page }) => {
  installFakeAudio(page);
  await page.goto(APP_URL);
  await openCustomTopic(page);
  await useText(page, 'Five < ten is a statement that is definitely true.');

  await page.locator('#play').click();

  await expect
    .poll(() => page.evaluate(() => (window as any).__spokenText as string[]), { timeout: 15_000 })
    .toContain('Five < ten is a statement that is definitely true.');
});
