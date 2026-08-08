import { test, expect, Page } from '@playwright/test';
import { installFakeAudio } from './helpers/fake-audio';

const APP_URL = '/';

function startInTypingMode(page: Page): void {
  void page.addInitScript(() => {
    localStorage.setItem('shadowing.settings', JSON.stringify({
      deckId: 'all',
      rate: 1,
      slack: 1,
      voiceName: '',
      durationMin: 0,
      blur: false,
      stt: true,
      repeat: false,
      typing: true,
    }));
  });
}

async function currentLineText(page: Page): Promise<string> {
  return (await page.locator('.lines p.current .text').innerText()).trim();
}

async function openTypingBox(page: Page): Promise<string> {
  await page.locator('.lines p').first().click();
  await expect(page.locator('.validate-box.typing input')).toBeVisible();
  return currentLineText(page);
}

test('the option remembers itself and needs no microphone', async ({ page }) => {
  installFakeAudio(page);
  await page.addInitScript(() => {
    const media = navigator.mediaDevices;
    if (media) { media.getUserMedia = () => Promise.reject(new Error('denied')); }
  });
  await page.goto(APP_URL);

  await page.locator('#options').click();
  await page.locator('#typing').click();
  await expect(page.locator('#typing')).toHaveAttribute('aria-pressed', 'true');

  await page.locator('#validate').click();
  await expect(page.locator('#validate')).toHaveAttribute('aria-pressed', 'true');

  await page.reload();
  await page.locator('#options').click();
  await expect(page.locator('#typing')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#validate')).toHaveAttribute('aria-pressed', 'true');
});

test('typing the sentence exactly scores five stars', async ({ page }) => {
  installFakeAudio(page);
  startInTypingMode(page);
  await page.goto(APP_URL);

  const sentence = await openTypingBox(page);
  await page.locator('.validate-box.typing input').fill(sentence);
  await page.locator('.validate-box.typing input').press('Enter');

  const box = page.locator('.validate-box').first();
  await expect(box).toHaveClass(/scored/);
  await expect(box.locator('.stars')).toHaveText('★★★★★');
  await expect(box.locator('.wrong')).toHaveCount(0);
});

test('a misspelled word is marked and costs the top mark', async ({ page }) => {
  installFakeAudio(page);
  startInTypingMode(page);
  await page.goto(APP_URL);

  const sentence = await openTypingBox(page);
  const broken = sentence.replace(/\b(\w{6,})\b/, (w) => `${w.slice(0, -2)}xz`);
  expect(broken).not.toBe(sentence);

  await page.locator('.validate-box.typing input').fill(broken);
  await page.locator('.validate-box.typing input').press('Enter');

  const box = page.locator('.validate-box').first();
  await expect(box).toHaveClass(/scored/);
  await expect(box.locator('.wrong')).toHaveCount(1);
  await expect(box.locator('.stars')).not.toHaveText('★★★★★');
});

test('a missing word is named', async ({ page }) => {
  installFakeAudio(page);
  startInTypingMode(page);
  await page.goto(APP_URL);

  const sentence = await openTypingBox(page);
  const words = sentence.split(/\s+/);
  const dropped = [...words.slice(0, -2), words[words.length - 1]].join(' ');

  await page.locator('.validate-box.typing input').fill(dropped);
  await page.locator('.validate-box.typing input').press('Enter');

  await expect(page.locator('.validate-box .missed').first()).toContainText('missed:');
});

test('no microphone is ever requested in typing mode', async ({ page }) => {
  installFakeAudio(page);
  startInTypingMode(page);
  await page.addInitScript(() => {
    (window as any).__micAsked = false;
    const media = navigator.mediaDevices;
    if (media) {
      media.getUserMedia = () => {
        (window as any).__micAsked = true;
        return Promise.reject(new Error('denied'));
      };
    }
  });
  await page.goto(APP_URL);

  const sentence = await openTypingBox(page);
  await page.locator('.validate-box.typing input').fill(sentence);
  await page.locator('.validate-box.typing input').press('Enter');
  await expect(page.locator('.validate-box').first()).toHaveClass(/scored/);

  expect(await page.evaluate(() => (window as any).__micAsked)).toBe(false);
});

test('space typed into the box does not toggle playback', async ({ page }) => {
  installFakeAudio(page);
  startInTypingMode(page);
  await page.goto(APP_URL);

  await openTypingBox(page);
  const input = page.locator('.validate-box.typing input');
  await input.fill('two words');
  await input.press(' ');

  await expect(page.locator('#play')).toHaveText(/Auto Play/);
});

test('playback waits for the typed answer, then moves on', async ({ page }) => {
  installFakeAudio(page, { speakMs: 200 });
  startInTypingMode(page);
  await page.goto(APP_URL);

  await page.locator('#play').click();
  await expect(page.locator('.validate-box.typing input')).toBeVisible({ timeout: 15_000 });

  const index = () => page.evaluate(() => (window as any).__shadowing.state.index);
  expect(await index()).toBe(0);

  const sentence = await currentLineText(page);
  await page.locator('.validate-box.typing input').fill(sentence);
  await page.locator('.validate-box.typing input').press('Enter');

  await expect.poll(index, { timeout: 15_000 }).toBe(1);
});
