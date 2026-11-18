import { test, expect, gotoApp, Page } from './helpers/fixtures';
import { installFakeAudio } from './helpers/fake-audio';

/**
 * Misspells exactly one word, whatever the sentence is.
 *
 * The longest run of letters is mangled by swapping its last letter for "xz",
 * a pair no target word can end in, so the scorer always sees one unmatched
 * typed word and one missed target word. Every sentence has a longest word,
 * which is why this cannot degrade into a no-op the way "the first word of six
 * letters or more" did on the 68 B1 sentences that have no such word.
 */
function misspellOneWord(sentence: string): string {
  const parts = sentence.split(/(\s+)/);
  let at = -1;
  let longest = 0;
  parts.forEach((part, i) => {
    const word = /[A-Za-z']+/.exec(part)?.[0] ?? '';
    if (word.length > longest) { longest = word.length; at = i; }
  });
  if (at < 0) { throw new Error(`no word to misspell in: ${sentence}`); }

  return parts
    .map((part, i) => (i === at ? part.replace(/[A-Za-z']+/, (w) => `${w.slice(0, -1)}xz`) : part))
    .join('');
}

function stripTags(sentence: string): string {
  let stripped = sentence;
  let previous = '';
  while (stripped !== previous) {
    previous = stripped;
    stripped = stripped.replace(/<[^>]*>/g, '');
  }
  return stripped;
}

async function currentLineText(page: Page): Promise<string> {
  await expect.poll(
    () => page.evaluate(() => ((window as any).__spokenText as string[] | undefined)?.length ?? 0),
  ).toBeGreaterThan(0);
  return page.evaluate(() => ((window as any).__spokenText as string[])[0]);
}

/**
 * The answer is the exact sentence with its target-phrase markup stripped, laid
 * out word by word so the browser's innerText does not keep the letter-spacing.
 * Comparing on words makes the assertion robust to either spacing.
 */
function asPlain(sentence: string): string {
  return stripTags(sentence).replace(/[^\p{L}\p{N}']/gu, '');
}

async function answerText(page: Page): Promise<string> {
  return (await page.locator('.dict-answer').innerText()).replace(/[^\p{L}\p{N}']/gu, '');
}

async function startDictation(page: Page): Promise<void> {
  await page.locator('#play').waitFor({ state: 'detached' });
  await page.locator('#dictInput').waitFor({ state: 'visible' });
}

test('a dictation session opens one challenge at a time and needs no microphone', async ({ page }) => {
  installFakeAudio(page);
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
  await gotoApp(page, { activity: 'dictation', topic: null });
  await startDictation(page);
  await expect(page.locator('#dictInput')).toBeVisible();
  expect(await page.evaluate(() => (window as any).__micAsked)).toBe(false);
});

test('typing the sentence exactly shows Correct and then advances', async ({ page }) => {
  installFakeAudio(page);
  await gotoApp(page, { activity: 'dictation', topic: null });
  const sentence = await currentLineText(page);
  const typed = stripTags(sentence);
  await page.locator('#dictInput').fill(typed);
  await page.locator('#dictCheck').click();
  await expect(page.locator('.dict-verdict')).toHaveText('Correct');
  expect(await answerText(page)).toBe(asPlain(typed));
  await page.locator('#dictNext').click();
  await expect(page.locator('#dictationCount')).toContainText('2 /');
});

test('a misspelled word shows Incorrect with a masked answer', async ({ page }) => {
  installFakeAudio(page);
  await gotoApp(page, { activity: 'dictation', topic: null });
  const sentence = stripTags(await currentLineText(page));
  const broken = misspellOneWord(sentence);
  await page.locator('#dictInput').fill(broken);
  await page.locator('#dictCheck').click();
  await expect(page.locator('.dict-verdict')).toHaveText(/Incorrect/i);
  await expect(page.locator('.dict-masked')).toHaveCount(1);
  await expect(page.locator('.dict-masked')).toHaveText(/\*+/);
});

test('Skip leaves the challenge unanswered and moves on', async ({ page }) => {
  installFakeAudio(page);
  await gotoApp(page, { activity: 'dictation', topic: null });
  await page.locator('#dictSkip').click();
  await expect(page.locator('#dictationCount')).toContainText('2 /');
  await expect(page.locator('#dictInput')).toBeVisible();
  await expect(page.locator('.dict-answer')).toHaveCount(0);
});

test('Show full answer reveals the whole sentence on an incorrect check', async ({ page }) => {
  installFakeAudio(page);
  await gotoApp(page, { activity: 'dictation', topic: null });
  const sentence = stripTags(await currentLineText(page));
  await page.locator('#dictInput').fill(misspellOneWord(sentence));
  await page.locator('#dictCheck').click();
  await page.locator('#dictShowFull').check();
  await expect.poll(() => answerText(page)).toBe(asPlain(sentence));
});

test('the Move-to select jumps straight to a challenge', async ({ page }) => {
  installFakeAudio(page);
  await gotoApp(page, { activity: 'dictation', topic: null });
  await page.locator('#dictMoveTo').selectOption('2');
  await expect(page.locator('#dictationCount')).toContainText('3 /');
});
