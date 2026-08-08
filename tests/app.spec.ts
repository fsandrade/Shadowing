import { test, expect, Page } from '@playwright/test';
import { installFakeAudio } from './helpers/fake-audio';

const APP_URL = '/';
const TOTAL_LINES = 2242;

async function currentIndex(page: Page): Promise<number> {
  return page.evaluate(() => (window as any).__shadowing.state.index);
}

test('loads the corpus with numbered lines', async ({ page }) => {
  installFakeAudio(page);
  await page.goto(APP_URL);

  await expect(page).toHaveTitle('Shadowing');
  await expect(page.locator('.topics-title')).toHaveText('Topics');
  await expect(page.locator('#decks button')).toHaveCount(25);
  await expect(page.locator('.durations button').first()).toHaveAttribute('title', /minute/i);
  await expect(page.locator('.sliders label').first()).toHaveAttribute('title', /speed/i);
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

function filterOf(page: Page, selector: string) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    return el ? getComputedStyle(el).filter : null;
  }, selector);
}

test('blur mode blurs sentence text, keeps numbers, reveals on hover', async ({ page }) => {
  installFakeAudio(page);
  await page.goto(APP_URL);

  await page.locator('#blur').click();
  await expect(page.locator('#blur')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#lines')).toHaveClass(/blurred/);
  await expect.poll(() => filterOf(page, '.lines p .text')).toBe('blur(6px)');
  expect(await filterOf(page, '.lines p .num')).toBe('none');

  await page.hover('.lines p .text >> nth=0');
  await expect.poll(() => filterOf(page, '.lines p .text')).toBe('none');

  await page.locator('#blur').click();
  await expect(page.locator('#blur')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#lines')).not.toHaveClass(/blurred/);
  await expect.poll(() => filterOf(page, '.lines p .text')).toBe('none');
});

test('next (ArrowRight) reveals the line just passed in blur mode', async ({ page }) => {
  installFakeAudio(page);
  await page.goto(APP_URL);

  await page.locator('#blur').click();
  await expect.poll(() => currentIndex(page)).toBe(0);
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => currentIndex(page)).toBe(1);

  await expect(page.locator('.lines p').first()).toHaveClass(/spoken/);
  await expect.poll(() => filterOf(page, '.lines p.spoken .text')).toBe('none');
  await expect.poll(() => filterOf(page, '.lines p.current .text')).toBe('blur(6px)');
});

test('help modal opens, describes features, and closes', async ({ page }) => {
  installFakeAudio(page);
  await page.goto(APP_URL);

  await page.locator('#help').click();
  await expect(page.locator('#helpModal')).toBeVisible();
  await expect(page.locator('#helpModal')).toContainText(/How to use this app/i);
  await expect(page.locator('#helpModal')).toContainText(/Blur/i);
  await expect(page.locator('#helpModal')).toContainText(/gap/i);

  await page.keyboard.press('Escape');
  await expect(page.locator('#helpModal')).not.toBeVisible();

  await page.locator('#help').click();
  await page.locator('#helpModal').click({ position: { x: 10, y: 10 } });
  await expect(page.locator('#helpModal')).not.toBeVisible();

  await page.locator('#help').click();
  await page.locator('#helpClose').click();
  await expect(page.locator('#helpModal')).not.toBeVisible();
});

test('mobile keeps the topics bar as a single compact row', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  installFakeAudio(page);
  await page.goto(APP_URL);

  const height = await page.locator('.decks').evaluate((el) => el.getBoundingClientRect().height);
  expect(height).toBeLessThan(120);
  await expect(page.locator('.lines p').first()).toBeVisible();
});

test('shows a one-time dismissible Edge tip snack bar on non-Edge desktop browsers', async ({ page }) => {
  installFakeAudio(page);
  await page.goto(APP_URL);

  await expect(page.locator('#snackbar')).toBeVisible();
  await expect(page.locator('#snackbar')).toContainText(/Edge/i);
  await expect(page.locator('#edge-link')).toHaveAttribute('href', /^microsoft-edge:/);

  await page.locator('.snackbar-close').click();
  await expect(page.locator('#snackbar')).not.toBeVisible();

  await page.reload();
  await expect(page.locator('#snackbar')).not.toBeVisible();
});

test('in blur mode only already-spoken lines are revealed during playback', async ({ page }) => {
  installFakeAudio(page, { speakMs: 600 });
  await page.goto(APP_URL);

  await page.locator('#blur').click();
  await page.locator('#play').click();
  await expect(page.locator('#play')).toHaveText(/Pause/);

  await expect.poll(() => currentIndex(page), { timeout: 8000 }).toBeGreaterThan(0);

  await expect(page.locator('.lines p.spoken').first()).toHaveClass(/spoken/);
  await expect.poll(() => filterOf(page, '.lines p.spoken .text')).toBe('none');
  await expect.poll(() => filterOf(page, '.lines p.current .text')).toBe('blur(6px)');
  expect(await filterOf(page, '.lines p:not(.current):not(.spoken) .text')).toBe('blur(6px)');
});

test('ArrowLeft pressed twice in a row steps to the previous line', async ({ page }) => {
  installFakeAudio(page, { speakMs: 2000 });
  await page.goto(APP_URL);

  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => currentIndex(page), { timeout: 5000 }).toBe(3);

  await page.keyboard.press('ArrowLeft');
  await expect.poll(() => currentIndex(page), { timeout: 5000 }).toBe(3);

  await page.keyboard.press('ArrowLeft');
  await expect.poll(() => currentIndex(page), { timeout: 5000 }).toBe(2);
});

test('ArrowLeft pressed twice on the first line does not move', async ({ page }) => {
  installFakeAudio(page, { speakMs: 2000 });
  await page.goto(APP_URL);

  await expect.poll(() => currentIndex(page), { timeout: 5000 }).toBe(0);
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  await expect.poll(() => currentIndex(page), { timeout: 5000 }).toBe(0);
});