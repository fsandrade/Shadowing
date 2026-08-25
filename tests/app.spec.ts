import {
  test, expect, gotoApp, startActivity, Page,
} from './helpers/fixtures';
import { installFakeAudio } from './helpers/fake-audio';
import { breakSupabase, installFakeSupabase } from './helpers/fake-supabase';

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

  await page.locator('#levels [data-level-id="B1"]').click();
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

test('the chooser offers every activity, every topic and four durations', async ({ page }) => {
  installFakeAudio(page);
  await gotoApp(page, { activity: null });

  await expect(page.locator('.activity-card')).toHaveCount(5);
  await expect(page.locator('#startActivity')).toBeDisabled();
  await expect(page.locator('#decks')).toHaveCount(0);

  await page.locator('[data-activity-id="listening"]').click();

  await expect(page.locator('#allTopics')).toBeVisible();
  await expect(page.locator('#decks [data-deck-id]')).toHaveCount(TOPICS_AT_LEVEL);
  await expect(page.locator('.durations button')).toHaveCount(4);
  await expect(page.locator('.durations button').first())
    .toHaveAttribute('title', /minute/i);
  await expect(page.locator('.durations [data-min="0"]')).toHaveText('Unlimited');
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

test('the header keeps its right-hand controls flush right on the chooser and in practice',
  async ({ page }) => {
    installFakeAudio(page);
    await gotoApp(page, { activity: null });

    // There is no clock on the chooser - the icon group must still be held
    // against the right edge rather than collapsing next to the level chip.
    const headerWidth = await page.locator('header').evaluate((el) => el.getBoundingClientRect().width);
    const chooserLeft = await page.locator('#settings')
      .evaluate((el) => el.getBoundingClientRect().left);
    expect(chooserLeft).toBeGreaterThan(headerWidth / 2);

    await startActivity(page, 'shadowing');
    const practiceLeft = await page.locator('#settings')
      .evaluate((el) => el.getBoundingClientRect().left);
    expect(practiceLeft).toBeGreaterThan(headerWidth / 2);
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
  await expect.poll(rendered, { timeout: 5_000 }).toBeGreaterThan(0);
  const first = await rendered();
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

test('the level changes from the drawer, but not under a running activity', async ({ page }) => {
  installFakeAudio(page);
  await gotoApp(page, { activity: 'shadowing', topic: null, minutes: 15 });

  const opening = () => page.locator('.lines p .text').first().innerText();
  const running = await opening();
  await expect(page.locator('#levelChip')).toContainText('B1');

  await openSettings(page);
  await page.locator('#profileLevels [data-level-id="A2"]').click();

  // The profile moved; the activity on screen did not.
  await expect(page.locator('#levelChip')).toContainText('A2');
  expect(await opening()).toBe(running);

  // The next activity is the one that gets the new level.
  await page.locator('#closeSettings').click();
  await page.locator('#finish').click();
  await page.locator('#backToChooser').click();
  await startActivity(page, 'shadowing', null, 15);

  expect(await opening()).not.toBe(running);
});

test('the up arrow replays the audio in spelling without disturbing the answer',
  async ({ page }) => {
    installFakeAudio(page);
    await gotoApp(page, { activity: 'spelling', topic: null, minutes: 15 });

    await page.locator('#play').click();
    const field = page.locator('.typed-input');
    await expect(field).toBeVisible();
    await expect(field).toHaveAttribute('placeholder', /hear it again/i);

    await field.fill('half a sentence');
    const spokenCount = () => page.evaluate(
      () => ((window as unknown as { __spokenText?: string[] }).__spokenText ?? []).length,
    );
    const before = await spokenCount();

    await field.press('ArrowUp');

    // The audio was asked for again, and the half-typed answer survived.
    await expect(field).toHaveValue('half a sentence');
    expect(await spokenCount()).toBeGreaterThan(before);
  });

test('the chooser shows both practice panels, and still fits on one screen',
  async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    installFakeAudio(page);
    // Registered after the fixture's routes, so these win: the panels only
    // load for a signed-in learner, which the default harness is not.
    await installFakeSupabase(page, {
      signedIn: true,
      totals: {
        current_streak: 12,
        longest_streak: 20,
        days_studied: 47,
        practised_ms: 6 * 60 * 60_000 + 20 * 60_000,
        sentences_practised: 1312,
        sentences_distinct: 431,
        stars_earned: 4986,
        today_practised_ms: 14 * 60_000,
        today_sentences_practised: 38,
        today_sentences_distinct: 22,
        today_stars_earned: 156,
      },
    });
    await gotoApp(page, { activity: null });

    const all = page.locator('[data-panel="all"]');
    await expect(all).toBeVisible();
    await expect(all).toContainText('12');
    await expect(all).toContainText('best 20');
    await expect(all).toContainText('47');
    await expect(all).toContainText('6h 20m');
    await expect(all).toContainText('1312');
    await expect(all).toContainText('431');
    await expect(all).toContainText('3.8');

    const today = page.locator('[data-panel="today"]');
    await expect(today).toContainText('14m');
    await expect(today).toContainText('38');
    await expect(today).toContainText('4.1');
    await expect(today.locator('[data-stat="days"]')).toHaveCount(0);

    // Everything on the arrival screen has to be reachable without scrolling.
    let below = await page.evaluate(() => ['#startActivity', '.panels']
      .map((sel) => {
        const el = document.querySelector(sel);
        return el ? { sel, bottom: Math.round(el.getBoundingClientRect().bottom) } : null;
      })
      .filter((x): x is { sel: string; bottom: number } => x !== null)
      .filter((x) => x.bottom > window.innerHeight));
    expect(below).toEqual([]);

    // Choosing an activity hands the space to the choices: the panels are what
    // you read on arrival, and keeping them would push Start off a 720 screen.
    await page.locator('[data-activity-id="listening"]').click();
    await expect(page.locator('#decks [data-deck-id]')).toHaveCount(TOPICS_AT_LEVEL);
    await expect(page.locator('.panels')).toHaveCount(0);

    below = await page.evaluate(() => ['#startActivity', '.durations']
      .map((sel) => {
        const el = document.querySelector(sel);
        return el ? { sel, bottom: Math.round(el.getBoundingClientRect().bottom) } : null;
      })
      .filter((x): x is { sel: string; bottom: number } => x !== null)
      .filter((x) => x.bottom > window.innerHeight));

    expect(below).toEqual([]);
  });

test('an unlimited session counts up and ends only when the learner finishes', async ({ page }) => {
  installFakeAudio(page);
  await gotoApp(page, { activity: 'shadowing', topic: null, minutes: 0 });

  // Counting up from zero, not down from a duration nobody chose.
  await expect(page.locator('#clock')).toHaveText('00:00');
  await expect(page.locator('#clock')).toHaveAttribute('title', /time spent/i);

  await page.locator('#play').click();
  await expect(page.locator('#clock')).not.toHaveText('00:00');

  // Nothing but Finish gets the learner out of here.
  await page.locator('#finish').click();
  await expect(page.locator('.summary-title')).toContainText('Shadowing');
  await expect(page.locator('[data-stat="minutes"]')).toContainText(/\d+ sec|\d+ min/);
});

test('every start reshuffles, keeping the corpus and renumbering from one', async ({ page }) => {
  installFakeAudio(page);

  // Five lines, not one: a single line collides by chance about once in 700
  // runs, which is a flake. Five is one in 700^5.
  const opening = () => page.evaluate(
    () => [...document.querySelectorAll('.lines p .text')]
      .slice(0, 5).map((el) => el.textContent).join('|'),
  );

  await gotoApp(page, { activity: 'shadowing', topic: null });
  const before = await opening();

  await page.locator('#finish').click();
  await page.locator('#backToChooser').click();
  await startActivity(page, 'shadowing', null, 15);

  expect(await loadedLines(page)).toBe(TOTAL_LINES);
  await expect(page.locator('.lines p .num').first()).toHaveText('1');
  expect(await opening()).not.toBe(before);
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

  // An empty topic bar is also under 120px. Every topic at the level plus the
  // All topics entry must be in it for the height to mean anything.
  await expect(page.locator('#decks button')).toHaveCount(TOPICS_AT_LEVEL + 1);

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
    const controls = '#play, #next, #repeat, #finish, #settings, #help'
      + ', #blur, #rate, #slack, #voice, #rateOut, #slackOut';
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
