import { test, expect, Page } from '@playwright/test';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { installFakeAudio } from './helpers/fake-audio';

const APP_URL = pathToFileURL(path.join(__dirname, '..', 'index.html')).href;
const TOTAL_LINES = 1230;

async function currentIndex(page: Page): Promise<number> {
  return page.evaluate(() => (window as any).__shadowing.state.index);
}

test('loads the corpus with numbered lines', async ({ page }) => {
  installFakeAudio(page);
  await page.goto(APP_URL);

  await expect(page).toHaveTitle('Shadowing');
  await expect(page.locator('#decks button')).toHaveCount(15);
  await expect(page.locator('.lines p')).toHaveCount(TOTAL_LINES);
  await expect(page.locator('.lines p .num').first()).toHaveText('1');
  await expect(page.locator('.lines p .num').nth(1)).toHaveText('2');
});

test('warns and disables the controls when no English voice is available', async ({ page }) => {
  installFakeAudio(page, { voices: [{ name: 'Maria', lang: 'pt-BR' }] });
  await page.goto(APP_URL);

  await expect(page.locator('#banner')).toBeVisible();
  await expect(page.locator('#banner')).toContainText(/voz/i);
  await expect(page.locator('#play')).toBeDisabled();
  await expect(page.locator('#next')).toBeDisabled();
  await expect(page.locator('#shuffle')).toBeDisabled();
});

test('switching decks narrows the list and renumbers from one', async ({ page }) => {
  installFakeAudio(page);
  await page.goto(APP_URL);

  await page.locator('#decks button', { hasText: 'Daily Life' }).click();
  await expect(page.locator('.lines p')).toHaveCount(135);
  await expect(page.locator('.lines p .num').first()).toHaveText('1');
  await expect(page.locator('.lines p .num').nth(1)).toHaveText('2');
});

test('clicking a sentence highlights it, even when clicking the number', async ({ page }) => {
  installFakeAudio(page);
  await page.goto(APP_URL);

  await page.locator('.lines p').nth(2).locator('.num').click();
  await expect(page.locator('.lines p.current .num')).toHaveText('3');
});

test('shuffle keeps the corpus and renumbers from one', async ({ page }) => {
  installFakeAudio(page);
  await page.goto(APP_URL);

  const before = await page.locator('.lines p').first().innerText();
  await page.locator('#shuffle').click();

  await expect(page.locator('.lines p')).toHaveCount(TOTAL_LINES);
  await expect(page.locator('.lines p .num').first()).toHaveText('1');
  const after = await page.locator('.lines p').first().innerText();
  expect(after).not.toBe(before);
});

test('playback advances lines while the gap ring fills then disappears', async ({ page }) => {
  installFakeAudio(page, { speakMs: 600 });
  await page.goto(APP_URL);

  await page.locator('#play').click();
  await expect(page.locator('#play')).toHaveText(/Pause/);

  const ring = page.locator('.lines p.current .ring');
  await expect(ring).toBeVisible();

 
  const drained = () => page.evaluate(() => new Promise<boolean>((resolve) => {
    const fill = document.querySelector('.lines p.current .ring .ring-fill');
    if (!fill) { resolve(false); return; }
    let first: number | null = null;
    const start = performance.now();
    const tick = () => {
      const current = document.querySelector('.lines p.current .ring .ring-fill');
      const v = Number(current && current.getAttribute('stroke-dashoffset'));
      if (current !== fill) { resolve(first !== null && v < first); return; }
      if (first === null) { first = v; }
      else if (v < first) { resolve(true); return; }
      if (performance.now() - start < 400) { requestAnimationFrame(tick); } else { resolve(false); }
    };
    tick();
  }));
  await expect.poll(drained, { timeout: 8000 }).toBe(true);

  await expect(ring).toHaveCount(0);
  await expect.poll(() => currentIndex(page), { timeout: 5000 }).toBeGreaterThan(0);
});

test('space toggles playback and ArrowRight advances the index', async ({ page }) => {
  installFakeAudio(page, { speakMs: 2000 });
  await page.goto(APP_URL);

  await page.locator('#play').click();
  await expect(page.locator('#play')).toHaveText(/Pause/);
  await page.keyboard.press(' ');
  await expect(page.locator('#play')).toHaveText(/Play/);
  await page.keyboard.press(' ');
  await expect(page.locator('#play')).toHaveText(/Pause/);

  const before = await currentIndex(page);
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => currentIndex(page), { timeout: 5000 }).toBe(before + 1);
});