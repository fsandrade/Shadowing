import { test, expect, gotoApp, Page } from './helpers/fixtures';
import { installFakeAudio } from './helpers/fake-audio';
import { breakSupabase } from './helpers/fake-supabase';

const APP_URL = '/';

const TOTAL_LINES = 731;
const TOPICS_AT_LEVEL = 25;

async function currentIndex(page: Page): Promise<number> {
  return page.evaluate(() => (window as any).__shadowing.state.index);
}

async function openSettings(page: Page): Promise<void> {
  const toggle = page.locator('#settings');
  if (await toggle.getAttribute('aria-expanded') !== 'true') {
    await toggle.click();
  }
  await expect(page.locator('#settingsDrawer')).toHaveClass(/open/);

  await page.waitForFunction(() => {
    const el = document.querySelector('#settingsDrawer');
    if (!el) { return false; }
    const box = el.getBoundingClientRect();
    return box.right <= window.innerWidth + 0.5;
  });
}

async function closeSettings(page: Page): Promise<void> {
  await page.locator('#closeSettings').click();
  await expect(page.locator('.scrim')).toHaveCount(0);
}

async function loadedLines(page: Page): Promise<number> {
  return page.evaluate(() => (window as any).__shadowing.state.lines.length);
}

test('loads the corpus with numbered lines', async ({ page }) => {
  installFakeAudio(page);
  await gotoApp(page);

  await expect(page).toHaveTitle('Shadowing');
  await openSettings(page);
  await expect(page.locator('.sliders label').first()).toHaveAttribute('title', /speed/i);
  expect(await loadedLines(page)).toBe(TOTAL_LINES);
  await expect(page.locator('.lines p .num').first()).toHaveText('1');
  await expect(page.locator('.lines p .num').nth(1)).toHaveText('2');
});

test('a first-time visitor is asked for a level before anything else', async ({ page }) => {
  installFakeAudio(page);
  await gotoApp(page, { level: null });

  await expect(page.locator('.level-title')).toHaveText('Choose your level');

  await expect(page.locator('.lines p')).toHaveCount(0);
  await expect(page.locator('#activities')).toHaveCount(0);

  const cards = page.locator('.level-card');
  await expect(cards).toHaveCount(6);
  await expect(cards.filter({ hasText: 'Coming soon' })).toHaveCount(0);
  await expect(page.locator('.level-card:disabled')).toHaveCount(0);
  await expect(cards.first()).toContainText('You can follow very short');
  await expect(cards.first()).not.toContainText(/\d+ sentences/);

  await page.locator('.level-card[data-level-id="B1"]').click();

  await expect(page.locator('#activities')).toBeVisible();
  await expect.poll(() => loadedLines(page)).toBe(TOTAL_LINES);
  await expect(page.locator('#levelChip')).toContainText('B1');
});

test('a first visit asks for a level once, then never again', async ({ page }) => {
  installFakeAudio(page);
  await gotoApp(page, { level: null });
  await expect(page.locator('#levels')).toBeVisible();

  await page.locator('[data-level-id="B1"]').click();
  await expect(page.locator('#activities')).toBeVisible();
  await expect(page.locator('#levels')).toHaveCount(0);

  await page.reload();
  await expect(page.locator('#activities')).toBeVisible();
  await expect(page.locator('#levels')).toHaveCount(0);
});

test('the level survives a reload, and the app bar states it rather than changing it', async ({ page }) => {
  installFakeAudio(page);
  await gotoApp(page);
  await expect(page.locator('#levelChip')).toContainText('B1');

  await page.reload();
  await expect(page.locator('#levelChip')).toContainText('B1');

  // The level is asked once. The chip reports it; it is not a control.
  await expect(page.locator('button#levelChip')).toHaveCount(0);
});

test('the chooser offers every activity, every topic and three durations', async ({ page }) => {
  installFakeAudio(page);
  await gotoApp(page, { activity: null });

  await expect(page.locator('.activity-card')).toHaveCount(5);
  await expect(page.locator('#startActivity')).toBeDisabled();
  await expect(page.locator('#decks')).toHaveCount(0);

  await page.locator('[data-activity-id="listening"]').click();

  await expect(page.locator('#allTopics')).toBeVisible();
  await expect(page.locator('#decks [data-deck-id]')).toHaveCount(TOPICS_AT_LEVEL);
  await expect(page.locator('.durations button')).toHaveCount(3);
  await expect(page.locator('.durations button').first())
    .toHaveAttribute('title', /minute/i);
  await expect(page.locator('#startActivity')).toBeEnabled();
});

test('choosing an activity practises it, finishing shows a summary, back returns to the chooser',
  async ({ page }) => {
    installFakeAudio(page);
    await gotoApp(page, { activity: 'listening', topic: null, minutes: 5 });

    await expect(page.locator('#play')).toBeVisible();
    await expect(page.locator('.check-mode')).toHaveCount(0);

    await page.locator('#play').click();
    await expect(page.locator('#clock')).not.toHaveText('05:00');
    await page.locator('#finish').click();

    await expect(page.locator('.summary-title')).toContainText('Listening');
    // Seconds into a 5-minute session: the summary reports the time that was
    // spent, not the duration that was picked.
    await expect(page.locator('[data-stat="minutes"]')).toContainText(/\d+ sec/);
    await expect(page.locator('[data-stat="minutes"]')).not.toContainText('5 min');
    await expect(page.locator('[data-stat="stars"]')).toHaveCount(0);

    await page.locator('#backToChooser').click();
    await expect(page.locator('#activities')).toBeVisible();
  });

test('the activity sets blur, but the learner can still override it', async ({ page }) => {
  installFakeAudio(page);
  await gotoApp(page, { activity: 'listening', minutes: 5 });

  const blurred = () => page.evaluate(() => (window as any).__shadowing.state.blur as boolean);
  expect(await blurred()).toBe(true);

  await openSettings(page);
  await page.locator('#blur').click();
  expect(await blurred()).toBe(false);
});

test('My text keeps its own check-mode choice', async ({ page }) => {
  installFakeAudio(page);
  await gotoApp(page, { activity: null });
  await page.locator('[data-activity-id="custom"]').click();

  await expect(page.locator('#decks')).toHaveCount(0);
  await expect(page.locator('.chooser .custom-topic')).toBeVisible();
  await expect(page.locator('.chooser .check-mode')).toBeVisible();
});

test('the sentences arrive shuffled rather than grouped by topic', async ({ page }) => {
  installFakeAudio(page);
  await gotoApp(page);

  const firstFew = await page.evaluate(
    () => (window as any).__shadowing.state.lines.slice(0, 30) as string[],
  );
  expect(new Set(firstFew).size).toBe(firstFew.length);

  const inOrder = await page.evaluate(async () => {
    const res = await fetch('/rest/v1/sentences?offset=0&limit=1000');
    return (await res.json()).filter((r: any) => r.level_id === 'B1').map((r: any) => r.content);
  });
  expect(firstFew).not.toEqual(inOrder.slice(0, 30));
});

test('shows an error instead of an empty app when the content cannot be loaded', async ({ page }) => {
  installFakeAudio(page);
  await breakSupabase(page);

  await page.goto(APP_URL);

  await expect(page.locator('.startup-error')).toBeVisible();
  await expect(page.locator('.startup-error h1')).toHaveText('Practice is unavailable');

  await expect(page.locator('.lines p')).toHaveCount(0);
  await expect(page.locator('#play')).toHaveCount(0);
  await expect(page.locator('.startup-error button')).toHaveText('Try again');
});

test('renders a first page of lines and appends more as you scroll', async ({ page }) => {
  installFakeAudio(page);
  await gotoApp(page);

  const rendered = () => page.locator('.lines p').count();
  const first = await rendered();
  expect(first).toBeGreaterThan(0);
  expect(first).toBeLessThan(TOTAL_LINES);

  await page.locator('.lines').evaluate((el) => { el.scrollTop = el.scrollHeight; });
  await expect.poll(rendered).toBeGreaterThan(first);
});

test('warns and disables the controls when no English voice is available', async ({ page }) => {
  installFakeAudio(page, { voices: [{ name: 'Maria', lang: 'pt-BR' }] });
  await gotoApp(page);

  await expect(page.locator('#banner')).toBeVisible();
  await expect(page.locator('#banner')).toContainText(/no english voice/i);
  await expect(page.locator('#play')).toBeDisabled();
  await expect(page.locator('#next')).toBeDisabled();
  await expect(page.locator('#shuffle')).toBeDisabled();
});

test('warns about the audio on the chooser, before an activity is picked', async ({ page }) => {
  installFakeAudio(page, { voices: [{ name: 'Maria', lang: 'pt-BR' }] });
  await gotoApp(page, { activity: null });

  // The warning is raised at boot and the screen that boots is the chooser:
  // telling the learner only after they have picked an activity and a
  // duration is telling them too late.
  await expect(page.locator('#activities')).toBeVisible();
  await expect(page.locator('#banner')).toBeVisible();
  await expect(page.locator('#banner')).toContainText(/no english voice/i);
});

test('a banner can be dismissed with its close button', async ({ page }) => {
  installFakeAudio(page, { voices: [{ name: 'Maria', lang: 'pt-BR' }] });
  await gotoApp(page);

  await expect(page.locator('#banner')).toBeVisible();
  await page.locator('#banner .banner-close').click();
  await expect(page.locator('#banner')).not.toBeVisible();
});

test('starting on one topic narrows the list and renumbers from one', async ({ page }) => {
  installFakeAudio(page);
  await gotoApp(page, { topic: 'socializing' });

  await expect.poll(() => loadedLines(page)).toBe(26);
  await expect(page.locator('.lines p .num').first()).toHaveText('1');
  await expect(page.locator('.lines p .num').nth(1)).toHaveText('2');
});

test('clicking a sentence highlights it, even when clicking the number', async ({ page }) => {
  installFakeAudio(page);
  await gotoApp(page);

  await page.locator('.lines p').nth(2).locator('.num').click();
  await expect(page.locator('.lines p.current .num')).toHaveText('3');
});

test('shuffle keeps the corpus and renumbers from one', async ({ page }) => {
  installFakeAudio(page);
  await gotoApp(page);

  const before = await page.locator('.lines p').first().innerText();
  await page.locator('#shuffle').click();

  expect(await loadedLines(page)).toBe(TOTAL_LINES);
  await expect(page.locator('.lines p .num').first()).toHaveText('1');
  const after = await page.locator('.lines p').first().innerText();
  expect(after).not.toBe(before);
});

test('playback advances lines while the gap ring fills then disappears', async ({ page }) => {
  installFakeAudio(page, { speakMs: 600 });
  await gotoApp(page);

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
  await gotoApp(page);

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
  await gotoApp(page);

  await openSettings(page);
  await page.locator('#blur').click();
  await expect(page.locator('#blur')).toHaveAttribute('aria-pressed', 'true');
  await closeSettings(page);
  await expect(page.locator('#lines')).toHaveClass(/blurred/);
  await expect.poll(() => filterOf(page, '.lines p .text')).toBe('blur(6px)');
  expect(await filterOf(page, '.lines p .num')).toBe('none');

  await page.hover('.lines p .text >> nth=0');
  await expect.poll(() => filterOf(page, '.lines p .text')).toBe('none');

  await openSettings(page);
  await page.locator('#blur').click();
  await expect(page.locator('#blur')).toHaveAttribute('aria-pressed', 'false');
  await closeSettings(page);
  await expect(page.locator('#lines')).not.toHaveClass(/blurred/);
  await expect.poll(() => filterOf(page, '.lines p .text')).toBe('none');
});

test('next (ArrowRight) reveals the line just passed in blur mode', async ({ page }) => {
  installFakeAudio(page);
  await gotoApp(page);

  await openSettings(page);
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
  await gotoApp(page);

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

test('the chooser fits one screen once an activity is picked', async ({ page }) => {
  installFakeAudio(page);
  await gotoApp(page, { activity: null });
  await page.locator('[data-activity-id="shadowing"]').click();
  await expect(page.locator('#decks button')).toHaveCount(TOPICS_AT_LEVEL + 1);

  // One screen, three choices, one button: the topic list must not push the
  // duration control and Start below the fold.
  const below = await page.evaluate(() => ['#decks', '.durations', '#startActivity']
    .filter((sel) => document.querySelector(sel)!.getBoundingClientRect().bottom
      > window.innerHeight + 0.5));
  expect(below).toEqual([]);

  // It fits because the list gives ground, not because the topics went away.
  const scrolls = await page.locator('#decks')
    .evaluate((el) => el.scrollHeight > el.clientHeight + 1);
  expect(scrolls).toBe(true);

  // Start is at the foot of the screen now, so the one-time Edge tip must not
  // land on top of the button it is tipping about.
  const overlaps = await page.evaluate(() => {
    const start = document.querySelector('#startActivity')!.getBoundingClientRect();
    const tip = document.querySelector('#snackbar')!.getBoundingClientRect();
    return start.right > tip.left && tip.right > start.left
      && start.bottom > tip.top && tip.bottom > start.top;
  });
  expect(overlaps).toBe(false);
});

test('mobile keeps the chooser topics bar as a single compact row', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  installFakeAudio(page);
  await gotoApp(page, { activity: null });
  await page.locator('[data-activity-id="shadowing"]').click();

  const height = await page.locator('.decks').evaluate((el) => el.getBoundingClientRect().height);
  expect(height).toBeLessThan(120);

  await page.locator('.durations [data-min="15"]').click();
  await page.locator('#startActivity').click();
  await expect(page.locator('.lines p').first()).toBeVisible();
});

test('mobile keeps every control on screen with the settings drawer open', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  installFakeAudio(page);
  await gotoApp(page);
  await openSettings(page);

  const offscreen = await page.evaluate(() => {
    const controls = '#play, #next, #shuffle, #finish, #settings, #help'
      + ', #blur, #repeat, #rate, #slack, #voice, #rateOut, #slackOut';
    return [...document.querySelectorAll(controls)]
      .filter((el) => el.getBoundingClientRect().right > window.innerWidth + 0.5)
      .map((el) => el.id);
  });
  expect(offscreen).toEqual([]);

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBe(0);
});

test('shows a one-time dismissible Edge tip snack bar on non-Edge desktop browsers', async ({ page }) => {
  installFakeAudio(page);
  await gotoApp(page);

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
  await gotoApp(page);

  await openSettings(page);
  await page.locator('#blur').click();
  await closeSettings(page);
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
  await gotoApp(page);

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
  await gotoApp(page);

  await expect.poll(() => currentIndex(page), { timeout: 5000 }).toBe(0);
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  await expect.poll(() => currentIndex(page), { timeout: 5000 }).toBe(0);
});
