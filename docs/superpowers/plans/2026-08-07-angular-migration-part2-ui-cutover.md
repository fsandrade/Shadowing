# Angular Migration Part 2 — UI and Cutover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Prerequisite:** `docs/superpowers/plans/2026-08-07-angular-migration-part1-foundation.md` complete — `core/`, `data/`, `platform/`, `state/` and `playback/` all built and green (~150 unit tests).

**Goal:** Build the Angular component tree on top of the headless core, get all 15 existing Playwright specs passing against the Angular build, then delete the vanilla app and switch CI to the Angular build.

**Architecture:** Components use **attribute selectors** (`aside[appTopicList]`, `main[appPractice]`) so each *becomes* an existing element rather than nesting inside one — the emitted DOM matches the vanilla tree, and `src/styles.css` needs no further changes. No component declares its own styles. Components are presentational: they read signals from the stores and call store or `PlaybackService` methods. Five UI slices, each unlocking named Playwright specs, then the cutover.

**Tech Stack:** Angular 22.1 (standalone, zoneless, signals, native control flow), Vitest, Playwright 1.62.

## Global Constraints

- **Strict behavior parity.** Same DOM shape, same ids, same classes, same `title` and `aria-*` attributes, same copy. Where a string appears below, it is verbatim from `index.html` or `js/app.js`.
- **The 15 Playwright specs in `tests/app.spec.ts` are not edited**, except that `APP_URL` becomes the dev-server URL in Task 7. Every assertion stays as written. If a spec fails, the component is wrong, not the spec.
- **No component declares styles.** All styling stays in the global `src/styles.css`. No `styleUrl`, no `styles`, no `ViewEncapsulation` change.
- **Attribute selectors for anything that stands in for an existing element.** Never introduce a wrapper element inside `body`, `.app`, `main`, or `.lines` — the grid and descendant selectors in `src/styles.css` depend on that tree.
- **`window.__shadowing.state.index`** must exist and track `PracticeStore.index()`. The specs read it.
- **Banner copy comes from `MESSAGES`** (`src/app/state/messages.ts`), never inlined.
- **`localStorage` keys:** `shadowing.settings`, `shadowing.edgeTip`.
- **Every task ends on a commit** with `npm test` and `npm run test:e2e` green.
- **No file in `src/app/` exceeds ~150 lines.**
- **Reference spec:** `docs/superpowers/specs/2026-08-07-angular-migration-design.md`.

## Playwright spec index

Referenced by number throughout. From `tests/app.spec.ts`, in file order:

| # | Spec |
| --- | --- |
| 1 | loads the corpus with numbered lines |
| 2 | warns and disables the controls when no English voice is available |
| 3 | switching decks narrows the list and renumbers from one |
| 4 | clicking a sentence highlights it, even when clicking the number |
| 5 | shuffle keeps the corpus and renumbers from one |
| 6 | playback advances lines while the gap ring fills then disappears |
| 7 | space toggles playback and ArrowRight advances the index |
| 8 | blur mode blurs sentence text, keeps numbers, reveals on hover |
| 9 | next (ArrowRight) reveals the line just passed in blur mode |
| 10 | help modal opens, describes features, and closes |
| 11 | mobile keeps the topics bar as a single compact row |
| 12 | shows a one-time dismissible Edge tip snack bar |
| 13 | in blur mode only already-spoken lines are revealed during playback |
| 14 | ArrowLeft pressed twice in a row steps to the previous line |
| 15 | ArrowLeft pressed twice on the first line does not move |

---

### Task 7: Shell, topic list, line list — specs 1, 3, 4, 11

The first slice: the app renders the corpus. Switches Playwright from `file://` to the Angular dev server, and gets four specs green.

**Files:**
- Create: `src/app/ui/topic-list.ts`, `src/app/ui/line-list.ts`, `src/app/ui/practice.ts`, `src/app/ui/header-bar.ts`
- Create: `src/app/ui/topic-list.spec.ts`, `src/app/ui/line-list.spec.ts`
- Modify: `src/app/app.ts`, `src/app/app.html`
- Modify: `playwright.config.ts` (add `webServer`), `tests/app.spec.ts` (`APP_URL` only)
- Delete: `src/app/app.spec.ts` (the generated placeholder)

**Interfaces:**
- Consumes: `PracticeStore`, `SettingsStore`, `SessionTimerStore` (Part 1 Task 5); `PlaybackService` (Part 1 Task 6).
- Produces:
  - `TopicList` — `selector: 'aside[appTopicList]'`, host class `sidebar`
  - `LineList` — `selector: 'div[appLineList]'`, host class `lines`, id `lines`
  - `Practice` — `selector: 'main[appPractice]'`
  - `HeaderBar` — `selector: 'header[appHeaderBar]'`, with `help` output

- [ ] **Step 1: Write the failing test for `TopicList`**

`src/app/ui/topic-list.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { type Corpus } from '../core/deck';
import { SafeStorage } from '../platform/storage';
import { CORPUS_DATA } from '../state/corpus-token';
import { TopicList } from './topic-list';

const DATA: Corpus = {
  generatedAt: '2026-08-06T00:00:00Z',
  decks: [
    { id: 'a', name: 'Alpha', lines: ['a1', 'a2'] },
    { id: 'b', name: 'Beta', lines: ['b1'] },
  ],
};

function render() {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: SafeStorage, useValue: { read: () => null, write: () => {} } },
      { provide: CORPUS_DATA, useValue: DATA },
    ],
  });
  const fixture = TestBed.createComponent(TopicList);
  fixture.detectChanges();
  return fixture;
}

describe('TopicList', () => {
  it('renders as an <aside class="sidebar">', () => {
    const host = render().nativeElement as HTMLElement;
    expect(host.tagName).toBe('ASIDE');
    expect(host.classList.contains('sidebar')).toBe(true);
  });

  it('keeps the Topics heading and the labelled nav the stylesheet targets', () => {
    const host = render().nativeElement as HTMLElement;
    expect(host.querySelector('.topics-title')?.textContent).toBe('Topics');
    const nav = host.querySelector('nav.decks');
    expect(nav?.id).toBe('decks');
    expect(nav?.getAttribute('aria-label')).toBe('Topics');
    expect(nav?.querySelector('.decks-list')).not.toBeNull();
  });

  it('renders All first, then every deck with its count', () => {
    const buttons = [...(render().nativeElement as HTMLElement)
      .querySelectorAll<HTMLButtonElement>('#decks button')];
    expect(buttons.length).toBe(3);
    expect(buttons.map((b) => b.querySelector('span')?.textContent))
      .toEqual(['All', 'Alpha', 'Beta']);
    expect(buttons.map((b) => b.querySelector('.count')?.textContent))
      .toEqual(['3', '2', '1']);
  });

  it('marks the selected deck with aria-current', () => {
    const fixture = render();
    const host = fixture.nativeElement as HTMLElement;
    const buttons = [...host.querySelectorAll<HTMLButtonElement>('#decks button')];
    expect(buttons[0].getAttribute('aria-current')).toBe('true');

    buttons[2].click();
    fixture.detectChanges();
    expect(buttons[0].getAttribute('aria-current')).toBe('false');
    expect(buttons[2].getAttribute('aria-current')).toBe('true');
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

```bash
npm test -- --include src/app/ui/topic-list.spec.ts --watch=false
```

Expected: FAIL — cannot resolve `./topic-list`.

- [ ] **Step 3: Implement `topic-list.ts`**

`src/app/ui/topic-list.ts`:

```ts
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { PracticeStore } from '../state/practice-store';
import { SettingsStore } from '../state/settings-store';

/**
 * The topics sidebar. Declared on <aside> so no wrapper element appears between
 * `.app`'s grid and `.sidebar`, which the stylesheet's column layout requires.
 */
@Component({
  selector: 'aside[appTopicList]',
  host: { class: 'sidebar' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 class="topics-title">Topics</h2>
    <nav class="decks" id="decks" aria-label="Topics">
      <div class="decks-list">
        @for (opt of practice.deckOptions(); track opt.id) {
          <button
            type="button"
            [attr.data-deck-id]="opt.id"
            [attr.aria-current]="opt.id === settings.deckId()"
            (click)="practice.selectDeck(opt.id)"
          ><span>{{ opt.name }}</span><span class="count">{{ opt.count }}</span></button>
        }
      </div>
    </nav>
  `,
})
export class TopicList {
  protected readonly practice = inject(PracticeStore);
  protected readonly settings = inject(SettingsStore);
}
```

- [ ] **Step 4: Run it to confirm it passes**

```bash
npm test -- --include src/app/ui/topic-list.spec.ts --watch=false
```

Expected: PASS, 4 tests.

- [ ] **Step 5: Write the failing test for `LineList`**

`src/app/ui/line-list.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { type Corpus } from '../core/deck';
import { Speaker } from '../platform/speaker';
import { SafeStorage } from '../platform/storage';
import { CORPUS_DATA } from '../state/corpus-token';
import { PracticeStore } from '../state/practice-store';
import { SettingsStore } from '../state/settings-store';
import { LineList } from './line-list';

const DATA: Corpus = {
  generatedAt: '2026-08-06T00:00:00Z',
  decks: [{
    id: 'a',
    name: 'A',
    lines: ['plain one', 'with <b>a chunk</b> inside', 'third'],
  }],
};

function render() {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: SafeStorage, useValue: { read: () => null, write: () => {} } },
      { provide: CORPUS_DATA, useValue: DATA },
      {
        provide: Speaker,
        useValue: {
          supported: true,
          voices: () => [],
          onVoicesChanged: () => {},
          speak: () => Promise.resolve(),
          cancel: () => {},
          keepAlive: () => {},
        },
      },
    ],
  });
  const fixture = TestBed.createComponent(LineList);
  fixture.detectChanges();
  return {
    fixture,
    host: fixture.nativeElement as HTMLElement,
    practice: TestBed.inject(PracticeStore),
    settings: TestBed.inject(SettingsStore),
  };
}

describe('LineList structure', () => {
  it('renders as <div class="lines" id="lines">', () => {
    const { host } = render();
    expect(host.tagName).toBe('DIV');
    expect(host.classList.contains('lines')).toBe(true);
    expect(host.id).toBe('lines');
  });

  it('renders one <p> per line, numbered from 1', () => {
    const { host } = render();
    const nums = [...host.querySelectorAll('p .num')].map((n) => n.textContent);
    expect(host.querySelectorAll('p').length).toBe(3);
    expect(nums).toEqual(['1', '2', '3']);
  });

  it('renders the chunk markup inside .text', () => {
    const { host } = render();
    const text = host.querySelectorAll('p .text')[1];
    expect(text.querySelector('b')?.textContent).toBe('a chunk');
  });

  it('renumbers from one after a deck change', () => {
    const { fixture, host, practice } = render();
    practice.selectDeck('a');
    fixture.detectChanges();
    expect([...host.querySelectorAll('p .num')].map((n) => n.textContent))
      .toEqual(['1', '2', '3']);
  });
});

describe('LineList state classes', () => {
  it('marks the current line', () => {
    const { fixture, host, practice } = render();
    expect(host.querySelector('p.current .num')?.textContent).toBe('1');

    practice.goTo(2);
    fixture.detectChanges();
    expect(host.querySelector('p.current .num')?.textContent).toBe('3');
  });

  it('marks spoken lines', () => {
    const { fixture, host, practice } = render();
    practice.markSpoken(1);
    fixture.detectChanges();
    const ps = [...host.querySelectorAll('p')];
    expect(ps[0].classList.contains('spoken')).toBe(false);
    expect(ps[1].classList.contains('spoken')).toBe(true);
  });

  it('toggles the blurred class from the blur setting', () => {
    const { fixture, host, settings } = render();
    expect(host.classList.contains('blurred')).toBe(false);
    settings.setBlur(true);
    fixture.detectChanges();
    expect(host.classList.contains('blurred')).toBe(true);
  });
});

describe('LineList interaction', () => {
  it('clicking anywhere in a line selects it, including the number', () => {
    const { fixture, host, practice } = render();
    host.querySelectorAll<HTMLElement>('p .num')[2].click();
    fixture.detectChanges();
    expect(practice.index()).toBe(2);
    expect(host.querySelector('p.current .num')?.textContent).toBe('3');
  });
});
```

- [ ] **Step 6: Run it to confirm it fails**

```bash
npm test -- --include src/app/ui/line-list.spec.ts --watch=false
```

Expected: FAIL — cannot resolve `./line-list`.

- [ ] **Step 7: Implement `line-list.ts`**

The `ring` and `validate-box` slots are declared now but stay empty until Tasks 8 and 11 fill them.

`src/app/ui/line-list.ts`:

```ts
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { PlaybackService } from '../playback/playback-service';
import { PracticeStore } from '../state/practice-store';
import { SettingsStore } from '../state/settings-store';

/**
 * The scrolling sentence list. Declared on <div> with the `lines` class and id
 * so `main`'s grid row 3 and every `.lines p ...` selector still apply.
 * Every line is rendered — no virtual scrolling — matching the vanilla app.
 */
@Component({
  selector: 'div[appLineList]',
  host: {
    class: 'lines',
    id: 'lines',
    '[class.blurred]': 'settings.blur()',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (line of practice.lines(); track $index) {
      <p
        [class.current]="$index === practice.index()"
        [class.spoken]="practice.spoken().has($index)"
        (click)="playback.playLine($index)"
      ><span class="num">{{ $index + 1 }}</span><span
          class="text"
          [innerHTML]="line"
        ></span></p>
    }
  `,
})
export class LineList {
  protected readonly practice = inject(PracticeStore);
  protected readonly settings = inject(SettingsStore);
  protected readonly playback = inject(PlaybackService);
}
```

- [ ] **Step 8: Run it to confirm it passes**

```bash
npm test -- --include src/app/ui/line-list.spec.ts --watch=false
```

Expected: PASS, 8 tests.

- [ ] **Step 9: Implement `practice.ts` and `header-bar.ts`**

`.controls` is a plain wrapper div, so it needs no component of its own; the transport and slider components go inside it in Task 8.

`src/app/ui/practice.ts`:

```ts
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { LineList } from './line-list';

/**
 * The practice column. Declared on <main> so its own grid rows (controls,
 * banner, lines) stay direct children, as `main { grid-template-rows }` needs.
 */
@Component({
  selector: 'main[appPractice]',
  imports: [LineList],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="controls"></div>
    <div appLineList></div>
  `,
})
export class Practice {}
```

`src/app/ui/header-bar.ts`:

```ts
import { ChangeDetectionStrategy, Component, inject, output } from '@angular/core';
import { SessionTimerStore } from '../state/session-timer-store';

/** The top bar: title, session buttons, clock, help. Declared on <header>. */
@Component({
  selector: 'header[appHeaderBar]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>Shadowing</h1>
    <div class="durations" id="durations"></div>
    <div class="clock" id="clock">{{ timer.clockText() }}</div>
    <button
      type="button"
      class="help-btn"
      id="help"
      aria-label="How to use this app"
      title="How to use this app"
      (click)="help.emit()"
    >?</button>
  `,
})
export class HeaderBar {
  protected readonly timer = inject(SessionTimerStore);
  readonly help = output<void>();
}
```

- [ ] **Step 10: Wire the shell in `app.ts`**

Delete the generated `src/app/app.spec.ts` and `src/app/app.html`; the shell template is small enough to inline.

`src/app/app.ts`:

```ts
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { HeaderBar } from './ui/header-bar';
import { Practice } from './ui/practice';
import { TopicList } from './ui/topic-list';

@Component({
  selector: 'app-root',
  imports: [HeaderBar, TopicList, Practice],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header appHeaderBar></header>
    <div class="app">
      <aside appTopicList></aside>
      <main appPractice></main>
    </div>
  `,
})
export class App {}
```

```bash
rm src/app/app.spec.ts src/app/app.html
```

- [ ] **Step 11: Point Playwright at the Angular dev server**

`playwright.config.ts` — replace the whole file:

```ts
import { defineConfig, devices } from '@playwright/test';

const PORT = 4200;

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'on-first-retry',
  },
  /* ES modules cannot load over file://, so the app needs a real server now. */
  webServer: {
    command: `npx ng serve --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
```

In `tests/app.spec.ts`, replace the three URL lines at the top:

```ts
import { test, expect, Page } from '@playwright/test';
import { installFakeAudio } from './helpers/fake-audio';

const APP_URL = '/';
const TOTAL_LINES = 2242;
```

Nothing else in the file changes. The `node:path` and `node:url` imports become unused and are removed.

- [ ] **Step 12: Run the four specs this slice targets**

```bash
npx playwright test -g "loads the corpus with numbered lines"
npx playwright test -g "switching decks narrows the list"
npx playwright test -g "clicking a sentence highlights it"
npx playwright test -g "mobile keeps the topics bar"
```

Expected: all four PASS. Spec 1 asserts `#decks button` count 25 and `.lines p` count 2242; spec 11 asserts `.decks` height < 120 at 375 px wide, which the untouched mobile CSS provides.

Spec 1 also asserts `.durations button` first has a `/minute/i` title and `.sliders label` first has a `/speed/i` title — those land in Task 8, so spec 1 will not fully pass until then. Confirm the failure is only on those two assertions.

- [ ] **Step 13: Run the unit suite and the build**

```bash
npm test -- --watch=false && npx ng build
```

Expected: 162 Vitest tests pass; the build succeeds.

- [ ] **Step 14: Commit**

```bash
git add -A
git commit -m "feat(ui): render the corpus — shell, topic list and line list

Components use attribute selectors (aside[appTopicList], main[appPractice],
div[appLineList]) so each becomes an existing element instead of adding a
wrapper. The emitted DOM matches the vanilla tree, so src/styles.css needs no
further change.

Playwright now runs against ng serve rather than file://, since ES modules
cannot load from disk. Only APP_URL changed in tests/app.spec.ts; every
assertion is untouched.

Specs 3, 4 and 11 pass; spec 1 passes except for the durations and sliders
titles, which arrive with the transport controls.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Transport, sliders, banner, ring, debug bridge — specs 1, 2, 5, 6

Adds the controls, the voice-availability banner, the progress ring and the `window.__shadowing` bridge the specs read.

**Files:**
- Create: `src/app/ui/transport-controls.ts`, `src/app/ui/settings-sliders.ts`, `src/app/ui/duration-picker.ts`, `src/app/ui/banner-view.ts`, `src/app/ui/progress-ring.ts`
- Create: `src/app/ui/transport-controls.spec.ts`, `src/app/ui/progress-ring.spec.ts`, `src/app/ui/duration-picker.spec.ts`
- Create: `src/app/debug-bridge.ts`
- Create: `src/app/app-startup.ts`
- Modify: `src/app/ui/practice.ts`, `src/app/ui/header-bar.ts`, `src/app/ui/line-list.ts`, `src/app/app.ts`

**Interfaces:**
- Consumes: everything from Part 1; `progress` and `inGap` from `PlaybackService`.
- Produces:
  - `TransportControls` — `selector: 'div[appTransportControls]'`, host class `transport`
  - `SettingsSliders` — `selector: 'div[appSettingsSliders]'`, host class `sliders`
  - `DurationPicker` — `selector: 'div[appDurationPicker]'`, host class `durations`, id `durations`
  - `BannerView` — `selector: 'div[appBanner]'`, host class `banner`, id `banner`
  - `ProgressRing` — `selector: 'svg[appProgressRing]'`, input `progress: number`
  - `DebugBridge` service with `install()`
  - `AppStartup` service with `run()` — the ordered bootstrap from `js/app.js:791`

- [ ] **Step 1: Write the failing test for `ProgressRing`**

`src/app/ui/progress-ring.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { ProgressRing, RING_LENGTH } from './progress-ring';

function render(progress: number) {
  TestBed.resetTestingModule();
  const fixture = TestBed.createComponent(ProgressRing);
  fixture.componentRef.setInput('progress', progress);
  fixture.detectChanges();
  return fixture.nativeElement as SVGElement;
}

describe('ProgressRing', () => {
  it('renders as an <svg class="ring"> the stylesheet targets', () => {
    const host = render(0);
    expect(host.tagName.toLowerCase()).toBe('svg');
    expect(host.classList.contains('ring')).toBe(true);
    expect(host.getAttribute('viewBox')).toBe('0 0 20 20');
    expect(host.getAttribute('width')).toBe('18');
    expect(host.getAttribute('height')).toBe('18');
    expect(host.getAttribute('aria-hidden')).toBe('true');
  });

  it('draws a track circle and a fill circle', () => {
    const host = render(0);
    expect(host.querySelector('circle.ring-track')).not.toBeNull();
    expect(host.querySelector('circle.ring-fill')).not.toBeNull();
  });

  it('is fully drained at progress 0', () => {
    const fill = render(0).querySelector('circle.ring-fill')!;
    expect(Number(fill.getAttribute('stroke-dashoffset'))).toBeCloseTo(RING_LENGTH, 1);
  });

  it('is fully drawn at progress 1', () => {
    const fill = render(1).querySelector('circle.ring-fill')!;
    expect(Number(fill.getAttribute('stroke-dashoffset'))).toBeCloseTo(0, 1);
  });

  it('offset decreases as progress grows', () => {
    const at = (p: number) => Number(
      render(p).querySelector('circle.ring-fill')!.getAttribute('stroke-dashoffset'),
    );
    expect(at(0.75)).toBeLessThan(at(0.25));
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

```bash
npm test -- --include src/app/ui/progress-ring.spec.ts --watch=false
```

Expected: FAIL — cannot resolve `./progress-ring`.

- [ ] **Step 3: Implement `progress-ring.ts`**

`src/app/ui/progress-ring.ts`:

```ts
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

const RADIUS = 8;
export const RING_LENGTH = 2 * Math.PI * RADIUS;

/**
 * The gap countdown ring. Declared on <svg> with the `ring` class so the
 * existing `.lines p.current .ring` rules (including the -90deg rotation) apply.
 * Replaces the imperative createElementNS block in the vanilla app.
 */
@Component({
  selector: 'svg[appProgressRing]',
  host: {
    class: 'ring',
    viewBox: '0 0 20 20',
    width: '18',
    height: '18',
    'aria-hidden': 'true',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg:circle
      class="ring-track"
      cx="10" cy="10" [attr.r]="RADIUS" fill="none" stroke-width="3"
    />
    <svg:circle
      class="ring-fill"
      cx="10" cy="10" [attr.r]="RADIUS" fill="none" stroke-width="3"
      [attr.stroke-dasharray]="dashArray"
      [attr.stroke-dashoffset]="dashOffset()"
    />
  `,
})
export class ProgressRing {
  /** Gap completion, 0 to 1. */
  readonly progress = input.required<number>();

  protected readonly RADIUS = RADIUS;
  protected readonly dashArray = RING_LENGTH.toFixed(2);

  /** Full circumference at 0 (empty), zero at 1 (complete). */
  protected readonly dashOffset = computed(() =>
    (RING_LENGTH * (1 - this.progress())).toFixed(2),
  );
}
```

- [ ] **Step 4: Run it to confirm it passes**

```bash
npm test -- --include src/app/ui/progress-ring.spec.ts --watch=false
```

Expected: PASS, 5 tests.

- [ ] **Step 5: Mount the ring in `line-list.ts`**

Replace the template in `src/app/ui/line-list.ts`, add the import, and add `PlaybackService`-driven ring mounting. The ring must be a child of the `<p>`, after `.text`.

```ts
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { PlaybackService } from '../playback/playback-service';
import { PracticeStore } from '../state/practice-store';
import { SettingsStore } from '../state/settings-store';
import { ProgressRing } from './progress-ring';

@Component({
  selector: 'div[appLineList]',
  imports: [ProgressRing],
  host: {
    class: 'lines',
    id: 'lines',
    '[class.blurred]': 'settings.blur()',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (line of practice.lines(); track $index) {
      <p
        [class.current]="$index === practice.index()"
        [class.spoken]="practice.spoken().has($index)"
        (click)="playback.playLine($index)"
      ><span class="num">{{ $index + 1 }}</span><span
          class="text"
          [innerHTML]="line"
        ></span>@if ($index === practice.index() && playback.inGap()) {<svg
          appProgressRing
          [progress]="playback.progress()"
        ></svg>}</p>
    }
  `,
})
export class LineList {
  protected readonly practice = inject(PracticeStore);
  protected readonly settings = inject(SettingsStore);
  protected readonly playback = inject(PlaybackService);
}
```

- [ ] **Step 6: Write the failing test for `TransportControls`**

`src/app/ui/transport-controls.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { type Corpus } from '../core/deck';
import { PlaybackService } from '../playback/playback-service';
import { SPEECH_RECOGNITION_CTOR } from '../platform/speech-recognition';
import { Speaker } from '../platform/speaker';
import { SafeStorage } from '../platform/storage';
import { CORPUS_DATA } from '../state/corpus-token';
import { PracticeStore } from '../state/practice-store';
import { SettingsStore } from '../state/settings-store';
import { VoiceStore } from '../state/voice-store';
import { TransportControls } from './transport-controls';

const DATA: Corpus = {
  generatedAt: '2026-08-06T00:00:00Z',
  decks: [{ id: 'a', name: 'A', lines: ['one', 'two'] }],
};

function render(opts: { voices?: SpeechSynthesisVoice[]; stt?: boolean } = {}) {
  const voices = opts.voices ?? ([{ name: 'David', lang: 'en-US' }] as SpeechSynthesisVoice[]);
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: SafeStorage, useValue: { read: () => null, write: () => {} } },
      { provide: CORPUS_DATA, useValue: DATA },
      {
        provide: Speaker,
        useValue: {
          supported: true,
          voices: () => voices,
          onVoicesChanged: () => {},
          speak: vi.fn().mockResolvedValue(undefined),
          cancel: vi.fn(),
          keepAlive: vi.fn(),
        },
      },
      {
        provide: SPEECH_RECOGNITION_CTOR,
        useValue: opts.stt === false ? null : (class {} as never),
      },
    ],
  });
  TestBed.inject(VoiceStore).refresh();
  const fixture = TestBed.createComponent(TransportControls);
  fixture.detectChanges();
  return {
    fixture,
    host: fixture.nativeElement as HTMLElement,
    practice: TestBed.inject(PracticeStore),
    settings: TestBed.inject(SettingsStore),
    playback: TestBed.inject(PlaybackService),
    btn: (id: string) => fixture.nativeElement.querySelector(`#${id}`) as HTMLButtonElement,
  };
}

describe('TransportControls structure', () => {
  it('renders as <div class="transport"> with the five buttons', () => {
    const { host } = render();
    expect(host.classList.contains('transport')).toBe(true);
    expect([...host.querySelectorAll('button')].map((b) => b.id))
      .toEqual(['play', 'next', 'shuffle', 'blur', 'validate']);
  });

  it('keeps the vanilla titles the specs and tooltips rely on', () => {
    const { btn } = render();
    expect(btn('play').title).toMatch(/Play\/Pause \(space\)/);
    expect(btn('next').title).toBe('Next (→)');
    expect(btn('shuffle').title).toBe('Shuffle the sentences randomly');
    expect(btn('blur').title).toMatch(/practice from memory/);
    expect(btn('validate').title).toMatch(/Speech validator/);
  });
});

describe('TransportControls play label', () => {
  it('reads Play when idle and Pause while playing', () => {
    const { fixture, btn, practice } = render();
    expect(btn('play').textContent).toContain('Play');

    practice.setPlaying(true);
    fixture.detectChanges();
    expect(btn('play').textContent).toContain('Pause');
  });
});

describe('TransportControls disabled state', () => {
  it('disables play, next and shuffle when no English voice exists', () => {
    const { btn } = render({ voices: [{ name: 'Maria', lang: 'pt-BR' }] as SpeechSynthesisVoice[] });
    expect(btn('play').disabled).toBe(true);
    expect(btn('next').disabled).toBe(true);
    expect(btn('shuffle').disabled).toBe(true);
  });

  it('disables play, next and shuffle when the deck is empty', () => {
    const { fixture, btn, practice } = render();
    practice.selectDeck('missing');
    fixture.detectChanges();
    expect(btn('play').disabled).toBe(true);
  });

  it('enables them with an English voice and a non-empty deck', () => {
    const { btn } = render();
    expect(btn('play').disabled).toBe(false);
    expect(btn('next').disabled).toBe(false);
    expect(btn('shuffle').disabled).toBe(false);
  });

  it('disables validate when speech recognition is unavailable', () => {
    expect(render({ stt: false }).btn('validate').disabled).toBe(true);
  });
});

describe('TransportControls toggles', () => {
  it('blur reflects and updates the setting via aria-pressed', () => {
    const { fixture, btn, settings } = render();
    expect(btn('blur').getAttribute('aria-pressed')).toBe('false');

    btn('blur').click();
    fixture.detectChanges();
    expect(settings.blur()).toBe(true);
    expect(btn('blur').getAttribute('aria-pressed')).toBe('true');

    btn('blur').click();
    fixture.detectChanges();
    expect(settings.blur()).toBe(false);
  });

  it('play delegates to PlaybackService.toggle', () => {
    const { btn, playback } = render();
    const toggle = vi.spyOn(playback, 'toggle');
    btn('play').click();
    expect(toggle).toHaveBeenCalledOnce();
  });

  it('next and shuffle delegate to PlaybackService', () => {
    const { btn, playback } = render();
    const next = vi.spyOn(playback, 'next');
    const shuffle = vi.spyOn(playback, 'shuffle');
    btn('next').click();
    btn('shuffle').click();
    expect(next).toHaveBeenCalledOnce();
    expect(shuffle).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 7: Run it to confirm it fails**

```bash
npm test -- --include src/app/ui/transport-controls.spec.ts --watch=false
```

Expected: FAIL — cannot resolve `./transport-controls`.

- [ ] **Step 8: Implement `transport-controls.ts`**

The validator toggle's mic flow lands in Task 11; for now it only flips the setting.

`src/app/ui/transport-controls.ts`:

```ts
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { PlaybackService } from '../playback/playback-service';
import { SpeechRecognizer } from '../platform/speech-recognition';
import { Speaker } from '../platform/speaker';
import { PracticeStore } from '../state/practice-store';
import { SettingsStore } from '../state/settings-store';
import { VoiceStore } from '../state/voice-store';

const PLAY_TITLE = 'Play/Pause (space) · Repeat current sentence (←)';
const BLUR_TITLE = 'Blur the text to practice from memory (hover or playback reveals)';
const VALIDATE_TITLE = 'Speech validator: transcribe your repeat and rate it 0–5 stars';

@Component({
  selector: 'div[appTransportControls]',
  host: { class: 'transport' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button type="button" id="play" [disabled]="!enabled()"
      [title]="PLAY_TITLE" (click)="playback.toggle()">{{ playLabel() }}</button>
    <button type="button" id="next" [disabled]="!enabled()"
      title="Next (&rarr;)" (click)="playback.next()">&#9197;</button>
    <button type="button" id="shuffle" [disabled]="!enabled()"
      title="Shuffle the sentences randomly" (click)="playback.shuffle()">&#8644; shuffle</button>
    <button type="button" id="blur" [attr.aria-pressed]="settings.blur()"
      [title]="BLUR_TITLE" (click)="settings.setBlur(!settings.blur())">&#9682; blur</button>
    <button type="button" id="validate" [disabled]="!sttSupported"
      [attr.aria-pressed]="settings.sttEnabled()" [title]="VALIDATE_TITLE"
      (click)="settings.setSttEnabled(!settings.sttEnabled())">&#10003; validate</button>
  `,
})
export class TransportControls {
  protected readonly playback = inject(PlaybackService);
  protected readonly practice = inject(PracticeStore);
  protected readonly settings = inject(SettingsStore);
  private readonly voices = inject(VoiceStore);
  private readonly speaker = inject(Speaker);

  protected readonly PLAY_TITLE = PLAY_TITLE;
  protected readonly BLUR_TITLE = BLUR_TITLE;
  protected readonly VALIDATE_TITLE = VALIDATE_TITLE;

  protected readonly sttSupported = inject(SpeechRecognizer).supported();

  /**
   * Transport is dead without audio: no synthesis support, no English voice, or
   * nothing to practise. Blur and validate stay live, since they are text-only.
   */
  protected readonly enabled = computed(
    () => this.practice.hasLines() && this.speaker.supported && this.voices.hasEnglish(),
  );

  protected readonly playLabel = computed(
    () => (this.practice.playing() ? '⏸ Pause' : '▶ Play'),
  );
}
```

- [ ] **Step 9: Run it to confirm it passes**

```bash
npm test -- --include src/app/ui/transport-controls.spec.ts --watch=false
```

Expected: PASS, 10 tests.

- [ ] **Step 10: Write the failing test for `DurationPicker`**

`src/app/ui/duration-picker.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { type Corpus } from '../core/deck';
import { Speaker } from '../platform/speaker';
import { SafeStorage } from '../platform/storage';
import { CORPUS_DATA } from '../state/corpus-token';
import { SettingsStore } from '../state/settings-store';
import { DurationPicker } from './duration-picker';

const DATA: Corpus = {
  generatedAt: '2026-08-06T00:00:00Z',
  decks: [{ id: 'a', name: 'A', lines: ['one'] }],
};

function render() {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: SafeStorage, useValue: { read: () => null, write: () => {} } },
      { provide: CORPUS_DATA, useValue: DATA },
      {
        provide: Speaker,
        useValue: {
          supported: true, voices: () => [], onVoicesChanged: () => {},
          speak: () => Promise.resolve(), cancel: () => {}, keepAlive: () => {},
        },
      },
    ],
  });
  const fixture = TestBed.createComponent(DurationPicker);
  fixture.detectChanges();
  return {
    fixture,
    host: fixture.nativeElement as HTMLElement,
    settings: TestBed.inject(SettingsStore),
    buttons: () => [...(fixture.nativeElement as HTMLElement)
      .querySelectorAll<HTMLButtonElement>('button')],
  };
}

describe('DurationPicker', () => {
  it('renders as <div class="durations" id="durations">', () => {
    const { host } = render();
    expect(host.classList.contains('durations')).toBe(true);
    expect(host.id).toBe('durations');
  });

  it('offers 5, 10, 15 and unlimited with the vanilla data-min values', () => {
    expect(render().buttons().map((b) => b.dataset['min'])).toEqual(['5', '10', '15', '0']);
  });

  it('gives the first button a title mentioning minutes', () => {
    expect(render().buttons()[0].title).toBe('Set a 5-minute session');
  });

  it('labels the unlimited option with an infinity sign', () => {
    expect(render().buttons()[3].textContent?.trim()).toBe('∞');
    expect(render().buttons()[3].title).toBe('Practice with no time limit');
  });

  it('starts with unlimited pressed', () => {
    const pressed = render().buttons()
      .filter((b) => b.getAttribute('aria-pressed') === 'true');
    expect(pressed.map((b) => b.dataset['min'])).toEqual(['0']);
  });

  it('moves aria-pressed and updates the setting on click', () => {
    const { fixture, buttons, settings } = render();
    buttons()[1].click();
    fixture.detectChanges();

    expect(settings.durationMin()).toBe(10);
    expect(buttons().filter((b) => b.getAttribute('aria-pressed') === 'true')
      .map((b) => b.dataset['min'])).toEqual(['10']);
  });
});
```

- [ ] **Step 11: Run it to confirm it fails**

```bash
npm test -- --include src/app/ui/duration-picker.spec.ts --watch=false
```

Expected: FAIL — cannot resolve `./duration-picker`.

- [ ] **Step 12: Implement `duration-picker.ts`**

`src/app/ui/duration-picker.ts`:

```ts
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { PlaybackService } from '../playback/playback-service';
import { SessionTimerStore } from '../state/session-timer-store';
import { SettingsStore } from '../state/settings-store';

interface DurationOption {
  readonly min: number;
  readonly label: string;
  readonly title: string;
}

const OPTIONS: readonly DurationOption[] = [
  { min: 5, label: '5 min', title: 'Set a 5-minute session' },
  { min: 10, label: '10 min', title: 'Set a 10-minute session' },
  { min: 15, label: '15 min', title: 'Set a 15-minute session' },
  { min: 0, label: '∞', title: 'Practice with no time limit' },
];

/** Session-length buttons. Choosing one stops playback and resets the tally. */
@Component({
  selector: 'div[appDurationPicker]',
  host: { class: 'durations', id: 'durations' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (opt of OPTIONS; track opt.min) {
      <button
        type="button"
        [attr.data-min]="opt.min"
        [title]="opt.title"
        [attr.aria-pressed]="settings.durationMin() === opt.min"
        (click)="pick(opt.min)"
      >{{ opt.label }}</button>
    }
  `,
})
export class DurationPicker {
  protected readonly settings = inject(SettingsStore);
  private readonly timer = inject(SessionTimerStore);
  private readonly playback = inject(PlaybackService);

  protected readonly OPTIONS = OPTIONS;

  protected pick(min: number): void {
    this.playback.stop();
    this.settings.setDurationMin(min);
    this.timer.reset(min);
  }
}
```

- [ ] **Step 13: Run it to confirm it passes**

```bash
npm test -- --include src/app/ui/duration-picker.spec.ts --watch=false
```

Expected: PASS, 6 tests.

- [ ] **Step 14: Implement `settings-sliders.ts` and `banner-view.ts`**

`src/app/ui/settings-sliders.ts`:

```ts
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { SettingsStore } from '../state/settings-store';
import { VoiceStore } from '../state/voice-store';

/** Speed, gap and voice. Titles are verbatim from the vanilla index.html. */
@Component({
  selector: 'div[appSettingsSliders]',
  host: { class: 'sliders' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <label title="Speech speed: slower to catch every word, faster for a challenge">speed
      <input type="range" id="rate" min="0.2" max="2" step="0.1"
        [value]="settings.rate()"
        (input)="settings.setRate(+($any($event.target).value))">
      <output id="rateOut">{{ rateText() }}</output>
    </label>
    <label title="Gap between sentences: how long you have to repeat aloud">gap
      <input type="range" id="slack" min="0" max="3" step="0.1"
        [value]="settings.slack()"
        (input)="settings.setSlack(+($any($event.target).value))">
      <output id="slackOut">{{ slackText() }}</output>
    </label>
    <label title="Voice used to read the sentences">voice
      <select id="voice" [value]="selectedName()"
        (change)="settings.setVoiceName($any($event.target).value)">
        @for (v of voices.englishVoices(); track v.name) {
          <option [value]="v.name">{{ v.name }} ({{ v.lang }})</option>
        }
      </select>
    </label>
  `,
})
export class SettingsSliders {
  protected readonly settings = inject(SettingsStore);
  protected readonly voices = inject(VoiceStore);

  protected readonly rateText = computed(() => `${this.settings.rate().toFixed(2)}×`);
  protected readonly slackText = computed(() => `${this.settings.slack().toFixed(2)}×`);

  /** Falls back to whatever pickVoice resolved, so the select is never blank. */
  protected readonly selectedName = computed(
    () => this.settings.voiceName() || this.voices.selected()?.name || '',
  );
}
```

`src/app/ui/banner-view.ts`:

```ts
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { BannerStore } from '../state/banner-store';

/**
 * The single error/summary slot. `[innerHTML]` routes through DomSanitizer, so
 * the <b> and <code> in MESSAGES render while anything unexpected is stripped.
 */
@Component({
  selector: 'div[appBanner]',
  host: {
    class: 'banner',
    id: 'banner',
    '[class.show]': 'banner.visible()',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span [innerHTML]="banner.html()"></span>`,
})
export class BannerView {
  protected readonly banner = inject(BannerStore);
}
```

- [ ] **Step 15: Wire the new components into `practice.ts` and `header-bar.ts`**

In `src/app/ui/practice.ts`, replace the template and imports:

```ts
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { BannerView } from './banner-view';
import { LineList } from './line-list';
import { SettingsSliders } from './settings-sliders';
import { TransportControls } from './transport-controls';

@Component({
  selector: 'main[appPractice]',
  imports: [TransportControls, SettingsSliders, BannerView, LineList],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="controls">
      <div appTransportControls></div>
      <div appSettingsSliders></div>
    </div>
    <div appBanner></div>
    <div appLineList></div>
  `,
})
export class Practice {}
```

In `src/app/ui/header-bar.ts`, import `DurationPicker` and replace the empty durations div with `<div appDurationPicker></div>`:

```ts
import { ChangeDetectionStrategy, Component, inject, output } from '@angular/core';
import { SessionTimerStore } from '../state/session-timer-store';
import { DurationPicker } from './duration-picker';

@Component({
  selector: 'header[appHeaderBar]',
  imports: [DurationPicker],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>Shadowing</h1>
    <div appDurationPicker></div>
    <div class="clock" id="clock">{{ timer.clockText() }}</div>
    <button
      type="button"
      class="help-btn"
      id="help"
      aria-label="How to use this app"
      title="How to use this app"
      (click)="help.emit()"
    >?</button>
  `,
})
export class HeaderBar {
  protected readonly timer = inject(SessionTimerStore);
  readonly help = output<void>();
}
```

- [ ] **Step 16: Implement the debug bridge**

`src/app/debug-bridge.ts`:

```ts
import { inject, Injectable } from '@angular/core';
import { PlaybackService } from './playback/playback-service';
import { PracticeStore } from './state/practice-store';
import { SettingsStore } from './state/settings-store';

/**
 * Publishes `window.__shadowing.state` in the shape the Playwright suite reads,
 * so the specs need no rewrite. Getters, not a snapshot, so reads are always
 * current. This is a test seam, kept deliberately minimal.
 */
@Injectable({ providedIn: 'root' })
export class DebugBridge {
  private readonly practice = inject(PracticeStore);
  private readonly settings = inject(SettingsStore);
  private readonly playback = inject(PlaybackService);

  install(): void {
    if (typeof window === 'undefined') { return; }
    const practice = this.practice;
    const settings = this.settings;
    const playback = this.playback;

    (window as unknown as Record<string, unknown>)['__shadowing'] = {
      state: {
        get index() { return practice.index(); },
        get playing() { return practice.playing(); },
        get lines() { return practice.lines(); },
        get deckId() { return settings.deckId(); },
        get blur() { return settings.blur(); },
        get sttEnabled() { return settings.sttEnabled(); },
        get progress() { return playback.progress(); },
      },
    };
  }
}
```

- [ ] **Step 17: Implement the ordered startup**

Mirrors `init()` at `js/app.js:791` — including the empty-deck fallback and the two voice-availability banners.

`src/app/app-startup.ts`:

```ts
import { effect, inject, Injectable } from '@angular/core';
import { ALL_DECK_ID, linesFor } from './core/deck';
import { Speaker } from './platform/speaker';
import { BannerStore } from './state/banner-store';
import { CORPUS_DATA } from './state/corpus-token';
import { MESSAGES } from './state/messages';
import { PracticeStore } from './state/practice-store';
import { SessionTimerStore } from './state/session-timer-store';
import { SettingsStore } from './state/settings-store';
import { VoiceStore } from './state/voice-store';
import { DebugBridge } from './debug-bridge';
import { PlaybackService } from './playback/playback-service';

/** How often the clock text refreshes, matching the vanilla setInterval. */
const CLOCK_TICK_MS = 250;
/** Chrome silently pauses long-lived synthesis; poke it on this interval. */
const KEEPALIVE_MS = 10_000;

@Injectable({ providedIn: 'root' })
export class AppStartup {
  private readonly corpus = inject(CORPUS_DATA);
  private readonly settings = inject(SettingsStore);
  private readonly practice = inject(PracticeStore);
  private readonly timer = inject(SessionTimerStore);
  private readonly banner = inject(BannerStore);
  private readonly voices = inject(VoiceStore);
  private readonly speaker = inject(Speaker);
  private readonly playback = inject(PlaybackService);
  private readonly debug = inject(DebugBridge);

  run(): void {
    // A remembered deck that no longer has lines falls back to All.
    const wanted = this.settings.deckId();
    if (!linesFor(this.corpus, wanted).length) {
      this.settings.setDeckId(ALL_DECK_ID);
    }

    this.timer.reset(this.settings.durationMin());
    this.voices.refresh();
    this.watchAudioAvailability();

    setInterval(() => this.timer.tick(), CLOCK_TICK_MS);
    setInterval(() => this.speaker.keepAlive(), KEEPALIVE_MS);

    this.debug.install();
  }

  /**
   * Two distinct failures share the banner: the platform has no synthesis at
   * all, or it has synthesis but no English voice. The second can resolve
   * itself once `voiceschanged` fires, so it is cleared as well as raised.
   */
  private watchAudioAvailability(): void {
    if (!this.speaker.supported) {
      this.banner.show(MESSAGES.speechUnsupported, 'unsupported');
      return;
    }
    effect(() => {
      if (this.voices.voices().length && !this.voices.hasEnglish()) {
        this.playback.stop();
        this.banner.show(MESSAGES.noEnglishVoice, 'no-voice');
      } else {
        this.banner.clear('no-voice');
      }
    });
  }
}
```

- [ ] **Step 18: Call startup from `app.ts`**

```ts
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AppStartup } from './app-startup';
import { HeaderBar } from './ui/header-bar';
import { Practice } from './ui/practice';
import { TopicList } from './ui/topic-list';

@Component({
  selector: 'app-root',
  imports: [HeaderBar, TopicList, Practice],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header appHeaderBar></header>
    <div class="app">
      <aside appTopicList></aside>
      <main appPractice></main>
    </div>
  `,
})
export class App {
  constructor() {
    inject(AppStartup).run();
  }
}
```

- [ ] **Step 19: Run the specs this slice targets**

```bash
npx playwright test -g "loads the corpus with numbered lines"
npx playwright test -g "warns and disables the controls"
npx playwright test -g "shuffle keeps the corpus"
npx playwright test -g "playback advances lines while the gap ring"
```

Expected: all four PASS. Spec 1 now fully passes, including the durations and sliders titles. Spec 6 polls `stroke-dashoffset` decreasing, then asserts the ring reaches count 0 — `inGap` unmounting it handles that.

- [ ] **Step 20: Run everything**

```bash
npm test -- --watch=false && npm run test:e2e
```

Expected: 183 Vitest tests pass. Playwright: specs 1–6 and 11 pass; 7–10 and 12–15 still fail (keyboard, blur, modal and snackbar are Tasks 9 and 10).

- [ ] **Step 21: Commit**

```bash
git add -A
git commit -m "feat(ui): transport, sliders, session picker, banner and gap ring

Adds the controls column, the duration picker, the shared banner slot and a
declarative SVG progress ring that replaces the imperative createElementNS
block. AppStartup reproduces init()'s order, including the empty-deck fallback
and both voice-availability banners.

DebugBridge republishes window.__shadowing.state from the signals, so the
Playwright specs read the index exactly as before.

Specs 1, 2, 5 and 6 now pass alongside 3, 4 and 11.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: Keyboard shortcuts and blur reveal — specs 7, 8, 9, 13, 14, 15

Adds the keyboard map. Blur itself already works from Task 8's `blur` button and the untouched CSS; these specs also need `ArrowRight`/`ArrowLeft` and the `spoken` reveal, which the keyboard map drives.

**Files:**
- Create: `src/app/ui/shortcuts.ts`
- Create: `src/app/ui/shortcuts.spec.ts`
- Modify: `src/app/app.ts`

**Interfaces:**
- Consumes: `PlaybackService`, `PracticeStore`, and a `helpOpen` signal owned by `App` (Task 10 replaces the placeholder with the real modal).
- Produces: `Shortcuts` directive — `selector: '[appShortcuts]'`, input `helpOpen: boolean`, input `enabled: boolean`, output `closeHelp`.

- [ ] **Step 1: Write the failing test**

`src/app/ui/shortcuts.spec.ts`:

```ts
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type Corpus } from '../core/deck';
import { PlaybackService } from '../playback/playback-service';
import { Speaker } from '../platform/speaker';
import { SafeStorage } from '../platform/storage';
import { CORPUS_DATA } from '../state/corpus-token';
import { PracticeStore } from '../state/practice-store';
import { Shortcuts } from './shortcuts';

const DATA: Corpus = {
  generatedAt: '2026-08-06T00:00:00Z',
  decks: [{ id: 'a', name: 'A', lines: ['one', 'two', 'three', 'four'] }],
};

@Component({
  imports: [Shortcuts],
  template: `
    <div appShortcuts [enabled]="enabled()" [helpOpen]="helpOpen()"
      (closeHelp)="closed = closed + 1"></div>
    <input id="field">
    <select id="picker"><option>a</option></select>
    <textarea id="area"></textarea>
  `,
})
class Host {
  readonly enabled = signal(true);
  readonly helpOpen = signal(false);
  closed = 0;
}

/** Dispatches on document, so the directive's (document:keydown) host binding sees it. */
function press(key: string, init: KeyboardEventInit = {}) {
  document.dispatchEvent(new KeyboardEvent('keydown', {
    key, bubbles: true, cancelable: true, ...init,
  }));
}

/** Dispatches from a specific element, to exercise the form-control guard. */
function pressOn(el: Element, key: string) {
  el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
}

function setup() {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: SafeStorage, useValue: { read: () => null, write: () => {} } },
      { provide: CORPUS_DATA, useValue: DATA },
      {
        provide: Speaker,
        useValue: {
          supported: true,
          voices: () => [{ name: 'David', lang: 'en-US' }] as SpeechSynthesisVoice[],
          onVoicesChanged: () => {},
          speak: vi.fn().mockResolvedValue(undefined),
          cancel: vi.fn(),
          keepAlive: vi.fn(),
        },
      },
    ],
  });
  const fixture = TestBed.createComponent(Host);
  fixture.detectChanges();
  return {
    fixture,
    host: fixture.componentInstance,
    el: fixture.nativeElement as HTMLElement,
    practice: TestBed.inject(PracticeStore),
    playback: TestBed.inject(PlaybackService),
  };
}

describe('Shortcuts', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('space toggles playback', () => {
    const { playback } = setup();
    const toggle = vi.spyOn(playback, 'toggle');
    press(' ');
    expect(toggle).toHaveBeenCalledOnce();
  });

  it('ArrowRight advances', () => {
    const { playback } = setup();
    const next = vi.spyOn(playback, 'next');
    press('ArrowRight');
    expect(next).toHaveBeenCalledOnce();
  });

  it('a single ArrowLeft replays the current line without moving', () => {
    const { practice, playback } = setup();
    practice.goTo(2);
    const previous = vi.spyOn(playback, 'previous');
    press('ArrowLeft');
    expect(previous).not.toHaveBeenCalled();
    expect(practice.index()).toBe(2);
  });

  it('two ArrowLefts within the window step back one line', () => {
    const { practice } = setup();
    practice.goTo(2);
    press('ArrowLeft');
    vi.advanceTimersByTime(100);
    press('ArrowLeft');
    expect(practice.index()).toBe(1);
  });

  it('two ArrowLefts more than 500ms apart do not step back', () => {
    const { practice } = setup();
    practice.goTo(2);
    press('ArrowLeft');
    vi.advanceTimersByTime(600);
    press('ArrowLeft');
    expect(practice.index()).toBe(2);
  });

  it('two ArrowLefts on the first line do not move', () => {
    const { practice } = setup();
    press('ArrowLeft');
    press('ArrowLeft');
    expect(practice.index()).toBe(0);
  });

  it('any other key resets the double-press window', () => {
    const { practice } = setup();
    practice.goTo(2);
    press('ArrowLeft');
    press('ArrowRight');
    press('ArrowLeft');
    expect(practice.index()).toBeGreaterThan(1);
  });

  it('ignores keys typed into form controls', () => {
    const { el, playback } = setup();
    const toggle = vi.spyOn(playback, 'toggle');
    for (const id of ['field', 'picker', 'area']) {
      pressOn(el.querySelector(`#${id}`)!, ' ');
    }
    expect(toggle).not.toHaveBeenCalled();
  });

  it('ignores modified keys and auto-repeat', () => {
    const { playback } = setup();
    const toggle = vi.spyOn(playback, 'toggle');
    press(' ', { ctrlKey: true });
    press(' ', { altKey: true });
    press(' ', { metaKey: true });
    press(' ', { repeat: true });
    expect(toggle).not.toHaveBeenCalled();
  });

  it('does nothing at all while disabled', () => {
    const { fixture, host, playback } = setup();
    host.enabled.set(false);
    fixture.detectChanges();
    const toggle = vi.spyOn(playback, 'toggle');
    press(' ');
    expect(toggle).not.toHaveBeenCalled();
  });

  it('Escape closes the help modal when it is open', () => {
    const { fixture, host } = setup();
    host.helpOpen.set(true);
    fixture.detectChanges();
    press('Escape');
    expect(host.closed).toBe(1);
  });

  it('Escape does nothing when the modal is closed', () => {
    const { host } = setup();
    press('Escape');
    expect(host.closed).toBe(0);
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

```bash
npm test -- --include src/app/ui/shortcuts.spec.ts --watch=false
```

Expected: FAIL — cannot resolve `./shortcuts`.

- [ ] **Step 3: Implement `shortcuts.ts`**

The guard order matters and is preserved from `js/app.js:756-788`: the double-press window resets first, then the disabled check bails **before** the `Escape` branch — so `Escape` cannot close the modal while the transport is disabled.

`src/app/ui/shortcuts.ts`:

```ts
import { Directive, inject, input, output } from '@angular/core';
import { PlaybackService } from '../playback/playback-service';
import { Clock } from '../platform/clock';
import { PracticeStore } from '../state/practice-store';

/** Two ArrowLefts inside this window step back a line; a single one replays. */
const DOUBLE_PRESS_MS = 500;

@Directive({
  selector: '[appShortcuts]',
  host: { '(document:keydown)': 'onKeydown($event)' },
})
export class Shortcuts {
  /** False when the transport is dead (no audio, no lines). */
  readonly enabled = input(true);
  readonly helpOpen = input(false);
  readonly closeHelp = output<void>();

  private readonly playback = inject(PlaybackService);
  private readonly practice = inject(PracticeStore);
  private readonly clock = inject(Clock);

  private lastLeftAt = 0;

  protected onKeydown(e: KeyboardEvent): void {
    const target = e.target as HTMLElement | null;
    if (target && /^(INPUT|SELECT|TEXTAREA)$/.test(target.tagName)) { return; }
    if (e.altKey || e.ctrlKey || e.metaKey || e.repeat) { return; }

    // Any other key breaks a pending double-press.
    if (e.key !== 'ArrowLeft') { this.lastLeftAt = 0; }

    // Bails before the Escape branch, exactly as the vanilla handler did.
    if (!this.enabled()) { return; }

    if (e.key === 'Escape' && this.helpOpen()) {
      e.preventDefault();
      this.closeHelp.emit();
      return;
    }

    if (e.key === ' ') {
      e.preventDefault();
      this.playback.toggle();
      return;
    }

    if (e.key === 'ArrowRight') {
      e.preventDefault();
      this.playback.next();
      return;
    }

    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      this.onArrowLeft();
    }
  }

  /**
   * First press replays the current line from the start; a second press inside
   * the window steps back one line first.
   */
  private onArrowLeft(): void {
    const now = this.clock.now();
    if (this.practice.index() > 0 && now - this.lastLeftAt <= DOUBLE_PRESS_MS) {
      this.practice.back();
      this.lastLeftAt = 0;
    } else {
      this.lastLeftAt = now;
    }
    this.playback.play();
  }
}
```

- [ ] **Step 4: Run it to confirm it passes**

```bash
npm test -- --include src/app/ui/shortcuts.spec.ts --watch=false
```

Expected: PASS, 12 tests.

- [ ] **Step 5: Attach the directive in `app.ts`**

`Shortcuts` needs a host element. `app-root` is `display: contents`, so binding it there adds no box.

```ts
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { AppStartup } from './app-startup';
import { Speaker } from './platform/speaker';
import { PracticeStore } from './state/practice-store';
import { VoiceStore } from './state/voice-store';
import { HeaderBar } from './ui/header-bar';
import { Practice } from './ui/practice';
import { Shortcuts } from './ui/shortcuts';
import { TopicList } from './ui/topic-list';

@Component({
  selector: 'app-root',
  imports: [HeaderBar, TopicList, Practice, Shortcuts],
  hostDirectives: [{
    directive: Shortcuts,
    inputs: ['enabled', 'helpOpen'],
    outputs: ['closeHelp'],
  }],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header appHeaderBar (help)="helpOpen.set(true)"></header>
    <div class="app">
      <aside appTopicList></aside>
      <main appPractice></main>
    </div>
  `,
})
export class App {
  private readonly practice = inject(PracticeStore);
  private readonly voices = inject(VoiceStore);
  private readonly speaker = inject(Speaker);

  protected readonly helpOpen = signal(false);

  /** Mirrors TransportControls.enabled — the shortcuts follow the buttons. */
  protected readonly enabled = computed(
    () => this.practice.hasLines() && this.speaker.supported && this.voices.hasEnglish(),
  );

  constructor() {
    inject(AppStartup).run();
  }
}
```

`hostDirectives` requires the inputs to be settable, so expose them from `App` by binding on the host instead. If `hostDirectives` input forwarding proves awkward here, the simpler equivalent is to move the directive onto the `.app` div:

```html
<div class="app" appShortcuts [enabled]="enabled()" [helpOpen]="helpOpen()"
  (closeHelp)="helpOpen.set(false)">
```

Prefer this second form — it is plainer, and `.app` is always present. Use it and drop `hostDirectives`.

- [ ] **Step 6: Run the specs this slice targets**

```bash
npx playwright test -g "space toggles playback"
npx playwright test -g "blur mode blurs sentence text"
npx playwright test -g "next \(ArrowRight\) reveals the line"
npx playwright test -g "in blur mode only already-spoken lines"
npx playwright test -g "ArrowLeft pressed twice"
```

Expected: specs 7, 8, 9, 13, 14 and 15 PASS.

- [ ] **Step 7: Run everything**

```bash
npm test -- --watch=false && npm run test:e2e
```

Expected: 195 Vitest tests pass. Playwright: 13 of 15 pass; only 10 (help modal) and 12 (Edge tip) fail.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(ui): keyboard shortcuts

Space toggles, ArrowRight advances, and ArrowLeft replays the current line —
stepping back only on a second press inside 500ms. Preserves the vanilla guard
order: form controls, modifiers and auto-repeat are ignored, the double-press
window resets on any other key, and the disabled check bails before Escape, so
Escape cannot close the modal while the transport is dead.

Specs 7, 8, 9, 13, 14 and 15 now pass; 13 of 15 green.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: Help modal and Edge tip — specs 10, 12

The last two specs. Both are self-contained overlays.

**Files:**
- Create: `src/app/ui/help-modal.ts`, `src/app/ui/edge-tip.ts`
- Create: `src/app/ui/help-modal.spec.ts`, `src/app/ui/edge-tip.spec.ts`
- Modify: `src/app/app.ts`

**Interfaces:**
- Consumes: `SafeStorage` (Part 1 Task 4).
- Produces:
  - `HelpModal` — `selector: 'div[appHelpModal]'`, input `open: boolean`, output `close`
  - `EdgeTip` — `selector: 'div[appEdgeTip]'`, with `EDGE_TIP_KEY = 'shadowing.edgeTip'`

- [ ] **Step 1: Write the failing test for `HelpModal`**

`src/app/ui/help-modal.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { HelpModal } from './help-modal';

function render(open: boolean) {
  TestBed.resetTestingModule();
  const fixture = TestBed.createComponent(HelpModal);
  fixture.componentRef.setInput('open', open);
  fixture.detectChanges();
  return { fixture, host: fixture.nativeElement as HTMLElement };
}

describe('HelpModal structure', () => {
  it('renders as the dialog the stylesheet and specs target', () => {
    const { host } = render(false);
    expect(host.classList.contains('modal')).toBe(true);
    expect(host.id).toBe('helpModal');
    expect(host.getAttribute('role')).toBe('dialog');
    expect(host.getAttribute('aria-modal')).toBe('true');
    expect(host.getAttribute('aria-labelledby')).toBe('helpTitle');
  });

  it('adds the show class only when open', () => {
    expect(render(false).host.classList.contains('show')).toBe(false);
    expect(render(true).host.classList.contains('show')).toBe(true);
  });

  it('keeps the panel structure and the titled heading', () => {
    const { host } = render(true);
    expect(host.querySelector('.modal-panel')).not.toBeNull();
    expect(host.querySelector('#helpTitle')?.textContent).toBe('How to use this app');
    expect(host.querySelector('#helpClose')?.getAttribute('aria-label')).toBe('Close help');
  });
});

describe('HelpModal content', () => {
  it('documents every feature the spec checks for', () => {
    const text = render(true).host.textContent ?? '';
    for (const term of ['How to use this app', 'Blur', 'gap', 'speed', 'voice',
                        'Shuffle', 'Play / Pause', 'Next', 'Session']) {
      expect(text, `help should mention ${term}`).toContain(term);
    }
  });
});

describe('HelpModal dismissal', () => {
  it('the close button emits close', () => {
    const { fixture, host } = render(true);
    let closed = 0;
    fixture.componentInstance.close.subscribe(() => { closed++; });
    host.querySelector<HTMLButtonElement>('#helpClose')!.click();
    expect(closed).toBe(1);
  });

  it('clicking the backdrop emits close', () => {
    const { fixture, host } = render(true);
    let closed = 0;
    fixture.componentInstance.close.subscribe(() => { closed++; });
    host.click();
    expect(closed).toBe(1);
  });

  it('clicking inside the panel does not emit close', () => {
    const { fixture, host } = render(true);
    let closed = 0;
    fixture.componentInstance.close.subscribe(() => { closed++; });
    host.querySelector<HTMLElement>('.modal-panel')!.click();
    expect(closed).toBe(0);
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

```bash
npm test -- --include src/app/ui/help-modal.spec.ts --watch=false
```

Expected: FAIL — cannot resolve `./help-modal`.

- [ ] **Step 3: Implement `help-modal.ts`**

Body copy is verbatim from `index.html:71-87`.

`src/app/ui/help-modal.ts`:

```ts
import {
  ChangeDetectionStrategy, Component, effect, ElementRef, inject, input, output,
} from '@angular/core';

@Component({
  selector: 'div[appHelpModal]',
  host: {
    class: 'modal',
    id: 'helpModal',
    role: 'dialog',
    'aria-modal': 'true',
    'aria-labelledby': 'helpTitle',
    '[class.show]': 'open()',
    '(click)': 'onBackdropClick($event)',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="modal-panel">
      <div class="modal-head">
        <h2 id="helpTitle">How to use this app</h2>
        <button type="button" class="modal-close" id="helpClose"
          aria-label="Close help" title="Close" (click)="close.emit()">&times;</button>
      </div>
      <div class="modal-body">
        <p>Shadowing is the simplest way to learn English chunks: pick a topic, listen to each sentence, and repeat it aloud in the pause after it.</p>
        <ol>
          <li>Choose a <b>Topic</b> on the left.</li>
          <li>Press <b>Play</b> and repeat every sentence aloud during the gap.</li>
          <li>Tune <b>speed</b>, <b>gap</b> and <b>voice</b> to your level.</li>
        </ol>
        <h3>What each feature is for</h3>
        <ul>
          <li><b>Play / Pause</b> (space) &mdash; start and stop the exercise. When paused, <b>&larr;</b> repeats the current sentence from the start.</li>
          <li><b>Next</b> (&rarr;) &mdash; jump ahead whenever you want.</li>
          <li><b>Shuffle</b> &mdash; randomize the order so you practice without memorizing the sequence.</li>
          <li><b>Session</b> (5/10/15 min) &mdash; set a daily goal; the app tracks your time and counts the sentences you practiced.</li>
          <li><b>speed</b> &mdash; slow it down to catch every sound, or speed it up when you feel ready.</li>
          <li><b>gap</b> &mdash; the pause between sentences is your time to repeat; make it longer when you need more time.</li>
          <li><b>voice</b> &mdash; pick the English voice that is easiest to understand (Microsoft Edge has the best selection).</li>
          <li><b>Blur</b> &mdash; hide the sentences while you practice, to build listening memory; already-practiced lines reappear so you can check yourself.</li>
        </ul>
      </div>
    </div>
  `,
})
export class HelpModal {
  readonly open = input(false);
  readonly close = output<void>();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private previousFocus: HTMLElement | null = null;

  constructor() {
    // Focus the close button on open and restore the prior focus on dismiss.
    effect(() => {
      if (this.open()) {
        this.previousFocus = document.activeElement as HTMLElement | null;
        this.host.nativeElement
          .querySelector<HTMLButtonElement>('#helpClose')?.focus();
      } else {
        this.previousFocus?.focus?.();
        this.previousFocus = null;
      }
    });
  }

  /** Only a click on the backdrop itself dismisses; clicks in the panel do not. */
  protected onBackdropClick(e: MouseEvent): void {
    if (e.target === this.host.nativeElement) { this.close.emit(); }
  }
}
```

- [ ] **Step 4: Run it to confirm it passes**

```bash
npm test -- --include src/app/ui/help-modal.spec.ts --watch=false
```

Expected: PASS, 7 tests.

- [ ] **Step 5: Write the failing test for `EdgeTip`**

`src/app/ui/edge-tip.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { SafeStorage } from '../platform/storage';
import { EDGE_TIP_KEY, EdgeTip, IS_EDGE, POINTER_IS_FINE } from './edge-tip';

function render(opts: {
  isEdge?: boolean; fine?: boolean; tipped?: boolean;
} = {}) {
  const write = vi.fn();
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: IS_EDGE, useValue: opts.isEdge ?? false },
      { provide: POINTER_IS_FINE, useValue: opts.fine ?? true },
      {
        provide: SafeStorage,
        useValue: { read: () => (opts.tipped ? '1' : null), write },
      },
    ],
  });
  const fixture = TestBed.createComponent(EdgeTip);
  fixture.detectChanges();
  return { fixture, host: fixture.nativeElement as HTMLElement, write };
}

describe('EdgeTip visibility', () => {
  it('shows on a non-Edge desktop browser that has not been tipped', () => {
    expect(render().host.classList.contains('show')).toBe(true);
  });

  it('stays hidden in Edge', () => {
    expect(render({ isEdge: true }).host.classList.contains('show')).toBe(false);
  });

  it('stays hidden on coarse pointers', () => {
    expect(render({ fine: false }).host.classList.contains('show')).toBe(false);
  });

  it('stays hidden once dismissed in an earlier session', () => {
    expect(render({ tipped: true }).host.classList.contains('show')).toBe(false);
  });
});

describe('EdgeTip structure', () => {
  it('renders as <div class="snackbar" id="snackbar">', () => {
    const { host } = render();
    expect(host.classList.contains('snackbar')).toBe(true);
    expect(host.id).toBe('snackbar');
  });

  it('mentions Edge and links with the microsoft-edge scheme', () => {
    const { host } = render();
    expect(host.textContent).toMatch(/Edge/i);
    expect(host.querySelector<HTMLAnchorElement>('#edge-link')!
      .getAttribute('href')).toMatch(/^microsoft-edge:/);
  });

  it('has a labelled dismiss button', () => {
    expect(render().host.querySelector('.snackbar-close')
      ?.getAttribute('aria-label')).toBe('Dismiss');
  });
});

describe('EdgeTip dismissal', () => {
  it('closing remembers the choice under the vanilla key', () => {
    const { fixture, host, write } = render();
    host.querySelector<HTMLButtonElement>('.snackbar-close')!.click();
    fixture.detectChanges();

    expect(host.classList.contains('show')).toBe(false);
    expect(write).toHaveBeenCalledWith(EDGE_TIP_KEY, '1');
  });

  it('exposes the storage key the vanilla app used', () => {
    expect(EDGE_TIP_KEY).toBe('shadowing.edgeTip');
  });
});
```

- [ ] **Step 6: Run it to confirm it fails**

```bash
npm test -- --include src/app/ui/edge-tip.spec.ts --watch=false
```

Expected: FAIL — cannot resolve `./edge-tip`.

- [ ] **Step 7: Implement `edge-tip.ts`**

`src/app/ui/edge-tip.ts`:

```ts
import {
  ChangeDetectionStrategy, Component, inject, InjectionToken, signal,
} from '@angular/core';
import { SafeStorage } from '../platform/storage';

export const EDGE_TIP_KEY = 'shadowing.edgeTip';

/** Auto-dismiss delay, matching the vanilla snack bar. */
const AUTO_HIDE_MS = 8000;

export const IS_EDGE = new InjectionToken<boolean>('IS_EDGE', {
  providedIn: 'root',
  factory: () => /Edg\//i.test(globalThis.navigator?.userAgent ?? ''),
});

export const POINTER_IS_FINE = new InjectionToken<boolean>('POINTER_IS_FINE', {
  providedIn: 'root',
  factory: () => globalThis.matchMedia?.('(pointer: fine)').matches ?? false,
});

/**
 * A one-time nudge toward Edge, which ships the best English voices. Shown only
 * on non-Edge desktop browsers, and only until dismissed.
 */
@Component({
  selector: 'div[appEdgeTip]',
  host: {
    class: 'snackbar',
    id: 'snackbar',
    '[class.show]': 'visible()',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span>Tip: for the best English voices, try practicing in
      <a id="edge-link" [href]="edgeHref">Microsoft Edge</a>.</span>
    <button type="button" class="snackbar-close" aria-label="Dismiss"
      title="Dismiss" (click)="dismiss()">&#215;</button>
  `,
})
export class EdgeTip {
  private readonly storage = inject(SafeStorage);
  private readonly isEdge = inject(IS_EDGE);
  private readonly pointerIsFine = inject(POINTER_IS_FINE);

  protected readonly visible = signal(false);

  /** Deep-links the current page into Edge, falling back to the public site. */
  protected readonly edgeHref = `microsoft-edge:${
    /^https?:/.test(globalThis.location?.protocol ?? '')
      ? globalThis.location.href
      : 'https://fsandrade.github.io/Shadowing/'
  }`;

  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    if (this.isEdge || !this.pointerIsFine) { return; }
    if (this.storage.read<string>(EDGE_TIP_KEY) === '1') { return; }

    this.visible.set(true);
    this.timer = setTimeout(() => this.visible.set(false), AUTO_HIDE_MS);
  }

  /** An explicit dismiss is remembered; the auto-hide is not. */
  protected dismiss(): void {
    clearTimeout(this.timer);
    this.visible.set(false);
    this.storage.write(EDGE_TIP_KEY, '1');
  }
}
```

- [ ] **Step 8: Run it to confirm it passes**

```bash
npm test -- --include src/app/ui/edge-tip.spec.ts --watch=false
```

Expected: PASS, 9 tests.

Note: `SafeStorage.write` JSON-encodes, so `'1'` lands as `"1"` on disk while the vanilla app wrote a bare `1`. `read` parses either, so a returning user's dismissal is still honoured. Confirm the round-trip in the next step.

- [ ] **Step 9: Verify the legacy Edge-tip value is still honoured**

Add to `src/app/ui/edge-tip.spec.ts`:

```ts
describe('EdgeTip legacy storage compatibility', () => {
  it('honours a bare 1 written by the vanilla app', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: IS_EDGE, useValue: false },
        { provide: POINTER_IS_FINE, useValue: true },
        // SafeStorage.read JSON-parses, so the vanilla bare `1` returns 1.
        { provide: SafeStorage, useValue: { read: () => 1, write: () => {} } },
      ],
    });
    const fixture = TestBed.createComponent(EdgeTip);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).classList.contains('show')).toBe(false);
  });
});
```

Then widen the guard in `edge-tip.ts` to accept both encodings:

```ts
    // The vanilla app wrote a bare 1; SafeStorage now writes "1". Accept both.
    const tipped = this.storage.read<string | number>(EDGE_TIP_KEY);
    if (tipped === '1' || tipped === 1) { return; }
```

- [ ] **Step 10: Run the edge-tip tests again**

```bash
npm test -- --include src/app/ui/edge-tip.spec.ts --watch=false
```

Expected: PASS, 10 tests.

- [ ] **Step 11: Mount both overlays in `app.ts`**

```ts
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { AppStartup } from './app-startup';
import { Speaker } from './platform/speaker';
import { PracticeStore } from './state/practice-store';
import { VoiceStore } from './state/voice-store';
import { EdgeTip } from './ui/edge-tip';
import { HeaderBar } from './ui/header-bar';
import { HelpModal } from './ui/help-modal';
import { Practice } from './ui/practice';
import { Shortcuts } from './ui/shortcuts';
import { TopicList } from './ui/topic-list';

@Component({
  selector: 'app-root',
  imports: [HeaderBar, TopicList, Practice, Shortcuts, EdgeTip, HelpModal],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header appHeaderBar (help)="helpOpen.set(true)"></header>
    <div class="app" appShortcuts
      [enabled]="enabled()"
      [helpOpen]="helpOpen()"
      (closeHelp)="helpOpen.set(false)">
      <aside appTopicList></aside>
      <main appPractice></main>
    </div>
    <div appEdgeTip></div>
    <div appHelpModal [open]="helpOpen()" (close)="helpOpen.set(false)"></div>
  `,
})
export class App {
  private readonly practice = inject(PracticeStore);
  private readonly voices = inject(VoiceStore);
  private readonly speaker = inject(Speaker);

  protected readonly helpOpen = signal(false);

  protected readonly enabled = computed(
    () => this.practice.hasLines() && this.speaker.supported && this.voices.hasEnglish(),
  );

  constructor() {
    inject(AppStartup).run();
  }
}
```

- [ ] **Step 12: Run the full Playwright suite**

```bash
npm run test:e2e
```

Expected: **all 15 specs PASS.** This is the parity gate.

- [ ] **Step 13: Run everything**

```bash
npm test -- --watch=false && npx ng build
```

Expected: 212 Vitest tests pass; the build succeeds.

- [ ] **Step 14: Commit**

```bash
git add -A
git commit -m "feat(ui): help modal and Edge tip snack bar

Both overlays port with their copy verbatim. The modal restores focus to
whatever was focused before it opened, and only a backdrop click dismisses it.
The Edge tip reads the legacy shadowing.edgeTip value in both the vanilla bare
1 and the new \"1\" encoding, so a returning user's dismissal is honoured.

All 15 Playwright specs now pass against the Angular build. Parity gate met.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 11: Speech validator and microphone flow

No existing Playwright spec covers the validator, so this task is driven entirely by unit tests. It wires `ValidationService` into `PlaybackService`'s hook and adds the inline result box.

**Files:**
- Create: `src/app/validation/validation-service.ts`, `src/app/ui/validate-box.ts`
- Create: `src/app/validation/validation-service.spec.ts`, `src/app/ui/validate-box.spec.ts`
- Modify: `src/app/ui/transport-controls.ts` (mic-gated toggle), `src/app/ui/line-list.ts` (mount the box), `src/app/app-startup.ts` (attach the hook, release the mic on unload)

**Interfaces:**
- Consumes: `SpeechRecognizer`, `MicrophoneService` (Part 1 Task 4); `starsFor` (`core/scoring.ts`); `BannerStore`, `MESSAGES`, `SettingsStore` (Part 1 Task 5); `PlaybackService.setValidationHook` (Part 1 Task 6).
- Produces:
  - `ValidationService` with `active: Signal<boolean>`, `lineIndex: Signal<number | null>`, `transcript: Signal<string>`, `stars: Signal<number | null>`; methods `begin(lineIndex, baseText): Promise<void> | null`, `dispose()`, `clear()`, `enable(): Promise<boolean>`, `disable()`
  - `ValidateBox` — `selector: 'div[appValidateBox]'`, host class `validate-box`

- [ ] **Step 1: Write the failing test for `ValidationService`**

`src/app/validation/validation-service.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { MicrophoneService } from '../platform/microphone';
import {
  type RecognitionOptions, type RecognitionSession, SpeechRecognizer,
} from '../platform/speech-recognition';
import { SafeStorage } from '../platform/storage';
import { BannerStore } from '../state/banner-store';
import { MESSAGES } from '../state/messages';
import { ValidationService } from './validation-service';

/** Captures the callbacks so a test can drive recognition by hand. */
function fakeRecognizer() {
  let opts: RecognitionOptions = {};
  const session: RecognitionSession & { started: boolean; aborted: boolean } = {
    started: false, aborted: false,
    start() { this.started = true; },
    stop() {},
    abort() { this.aborted = true; },
  };
  return {
    session,
    opts: () => opts,
    impl: {
      supported: () => true,
      recognize: (o: RecognitionOptions) => { opts = o; return session; },
    },
  };
}

function setup(opts: { denied?: boolean } = {}) {
  const rec = fakeRecognizer();
  const mic = {
    denied: () => opts.denied ?? false,
    ensure: vi.fn().mockResolvedValue({}),
    markDenied: vi.fn(),
    release: vi.fn(),
  };
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: SafeStorage, useValue: { read: () => null, write: () => {} } },
      { provide: SpeechRecognizer, useValue: rec.impl },
      { provide: MicrophoneService, useValue: mic },
    ],
  });
  return {
    rec, mic,
    validation: TestBed.inject(ValidationService),
    banner: TestBed.inject(BannerStore),
  };
}

describe('ValidationService session', () => {
  it('opens a listening box for the given line', () => {
    const { validation, rec } = setup();
    validation.begin(2, 'hit the road');

    expect(validation.active()).toBe(true);
    expect(validation.lineIndex()).toBe(2);
    expect(validation.transcript()).toBe(MESSAGES.listening);
    expect(validation.stars()).toBeNull();
    expect(rec.session.started).toBe(true);
    expect(rec.opts().lang).toBe('en-US');
  });

  it('shows interim text as it arrives', () => {
    const { validation, rec } = setup();
    validation.begin(0, 'hit the road');
    rec.opts().onInterim?.('hit the');
    expect(validation.transcript()).toBe('hit the');
  });

  it('rates a good repeat and resolves the wait', async () => {
    const { validation, rec } = setup();
    let settled = false;
    void validation.begin(0, 'hit the road')!.then(() => { settled = true; });

    rec.opts().onResult?.('hit the road');
    await Promise.resolve();

    expect(validation.transcript()).toBe('hit the road');
    expect(validation.stars()).toBe(5);
    expect(settled).toBe(true);
  });

  it('reports silence without stars', async () => {
    const { validation, rec } = setup();
    void validation.begin(0, 'hit the road');
    rec.opts().onResult?.('');
    await Promise.resolve();

    expect(validation.transcript()).toBe(MESSAGES.noSpeechDetected);
    expect(validation.stars()).toBeNull();
  });

  it('returns null instead of a session once the mic is denied', () => {
    const { validation } = setup({ denied: true });
    expect(validation.begin(0, 'hit the road')).toBeNull();
    expect(validation.active()).toBe(false);
  });
});

describe('ValidationService error handling', () => {
  it('ignores an aborted error, since that is our own cancellation', async () => {
    const { validation, rec } = setup();
    void validation.begin(0, 'hit the road');
    rec.opts().onError?.('aborted');
    expect(validation.transcript()).toBe(MESSAGES.listening);
  });

  it('latches denial and warns once on not-allowed', () => {
    const { validation, rec, mic, banner } = setup();
    validation.begin(0, 'hit the road');
    rec.opts().onError?.('not-allowed');

    expect(mic.markDenied).toHaveBeenCalledOnce();
    expect(validation.transcript()).toBe(MESSAGES.micDeniedInline);
    expect(banner.html()).toBe(MESSAGES.micDenied);
  });

  it('treats service-not-allowed the same way', () => {
    const { validation, rec, mic } = setup();
    validation.begin(0, 'hit the road');
    rec.opts().onError?.('service-not-allowed');
    expect(mic.markDenied).toHaveBeenCalledOnce();
  });

  it('skips validation on any other error and resolves the wait', async () => {
    const { validation, rec } = setup();
    let settled = false;
    void validation.begin(0, 'hit the road')!.then(() => { settled = true; });

    rec.opts().onError?.('network');
    await Promise.resolve();

    expect(validation.transcript()).toBe(MESSAGES.couldNotListen);
    expect(settled).toBe(true);
  });
});

describe('ValidationService disposal', () => {
  it('dispose aborts a live session and reports silence', () => {
    const { validation, rec } = setup();
    validation.begin(0, 'hit the road');
    validation.dispose();

    expect(rec.session.aborted).toBe(true);
    expect(validation.transcript()).toBe(MESSAGES.noSpeechDetected);
  });

  it('dispose leaves a completed result alone', async () => {
    const { validation, rec } = setup();
    void validation.begin(0, 'hit the road');
    rec.opts().onResult?.('hit the road');
    await Promise.resolve();
    validation.dispose();

    expect(validation.transcript()).toBe('hit the road');
    expect(validation.stars()).toBe(5);
  });

  it('clear removes the box entirely', () => {
    const { validation } = setup();
    validation.begin(0, 'hit the road');
    validation.clear();
    expect(validation.active()).toBe(false);
    expect(validation.lineIndex()).toBeNull();
  });
});

describe('ValidationService enable flow', () => {
  it('enable prompts for the mic and turns the setting on', async () => {
    const { validation, mic } = setup();
    await expect(validation.enable()).resolves.toBe(true);
    expect(mic.ensure).toHaveBeenCalledOnce();
  });

  it('enable resolves false and stays off when the prompt is refused', async () => {
    const { validation, mic } = setup();
    mic.ensure.mockRejectedValue(new Error('denied'));
    await expect(validation.enable()).resolves.toBe(false);
  });

  it('a second enable while the first is pending does not re-prompt', async () => {
    const { validation, mic } = setup();
    let release!: (v: unknown) => void;
    mic.ensure.mockReturnValue(new Promise((r) => { release = r; }));

    const first = validation.enable();
    const second = validation.enable();
    release({});
    await Promise.all([first, second]);

    expect(mic.ensure).toHaveBeenCalledOnce();
  });

  it('disable clears any open box', () => {
    const { validation } = setup();
    validation.begin(0, 'hit the road');
    validation.disable();
    expect(validation.active()).toBe(false);
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

```bash
npm test -- --include src/app/validation/validation-service.spec.ts --watch=false
```

Expected: FAIL — cannot resolve `./validation-service`.

- [ ] **Step 3: Implement `validation-service.ts`**

`src/app/validation/validation-service.ts`:

```ts
import { computed, inject, Injectable, signal } from '@angular/core';
import { starsFor } from '../core/scoring';
import { MicrophoneService } from '../platform/microphone';
import {
  type RecognitionSession, SpeechRecognizer,
} from '../platform/speech-recognition';
import { BannerStore } from '../state/banner-store';
import { MESSAGES } from '../state/messages';
import { SettingsStore } from '../state/settings-store';

/** Recognition error codes that mean the user refused the microphone. */
const DENIAL_CODES = new Set(['not-allowed', 'service-not-allowed']);

/**
 * Drives one recognition session per gap and exposes its result for the inline
 * box. `begin` returns a promise that PlaybackService races against the gap
 * timer, so a quick repeat moves on without waiting out the full pause.
 */
@Injectable({ providedIn: 'root' })
export class ValidationService {
  private readonly recognizer = inject(SpeechRecognizer);
  private readonly mic = inject(MicrophoneService);
  private readonly banner = inject(BannerStore);
  private readonly settings = inject(SettingsStore);

  private session: RecognitionSession | null = null;
  private settle: (() => void) | null = null;
  private deniedWarned = false;
  private enabling: Promise<boolean> | null = null;

  readonly lineIndex = signal<number | null>(null);
  readonly transcript = signal('');
  readonly stars = signal<number | null>(null);
  readonly active = computed(() => this.lineIndex() !== null);

  /** Returns null when there is nothing to listen with. */
  begin(lineIndex: number, baseText: string): Promise<void> | null {
    if (this.mic.denied() || !this.recognizer.supported()) { return null; }

    this.clear();
    this.lineIndex.set(lineIndex);
    this.transcript.set(MESSAGES.listening);
    this.stars.set(null);

    const done = new Promise<void>((resolve) => { this.settle = resolve; });

    this.session = this.recognizer.recognize({
      lang: 'en-US',
      onInterim: (t) => {
        if (!this.settle || !t) { return; }
        this.transcript.set(t);
      },
      onResult: (finalText) => {
        if (!this.settle) { return; }
        const rating = starsFor(baseText, finalText || '');
        if (rating === null) {
          this.transcript.set(MESSAGES.noSpeechDetected);
        } else {
          this.transcript.set(finalText || '');
          this.stars.set(rating);
        }
        this.finish();
      },
      onError: (code) => {
        // `aborted` is our own cancellation; never surface it.
        if (!this.settle || code === 'aborted') { return; }
        if (code && DENIAL_CODES.has(code)) {
          this.onDenied();
          return;
        }
        this.transcript.set(MESSAGES.couldNotListen);
        this.finish();
      },
    });
    this.session.start();
    return done;
  }

  /** Ends the gap's session; a box still saying "Listening…" means silence. */
  dispose(): void {
    this.session?.abort();
    this.session = null;
    if (this.transcript() === MESSAGES.listening) {
      this.transcript.set(MESSAGES.noSpeechDetected);
    }
    this.finish();
  }

  clear(): void {
    this.dispose();
    this.lineIndex.set(null);
    this.transcript.set('');
    this.stars.set(null);
  }

  /**
   * Asks for the microphone up front, so the first line does not lose its gap
   * to a permission prompt. Concurrent calls share one prompt.
   */
  enable(): Promise<boolean> {
    if (this.enabling) { return this.enabling; }
    this.enabling = this.mic.ensure().then(
      () => {
        this.enabling = null;
        this.settings.setSttEnabled(true);
        return true;
      },
      () => {
        this.enabling = null;
        return false;
      },
    );
    return this.enabling;
  }

  disable(): void {
    this.settings.setSttEnabled(false);
    this.clear();
  }

  private onDenied(): void {
    this.mic.markDenied();
    this.transcript.set(MESSAGES.micDeniedInline);
    if (!this.deniedWarned) {
      this.deniedWarned = true;
      this.banner.show(MESSAGES.micDenied, 'stt-denied');
    }
  }

  private finish(): void {
    const settle = this.settle;
    this.settle = null;
    settle?.();
  }
}
```

- [ ] **Step 4: Run it to confirm it passes**

```bash
npm test -- --include src/app/validation/validation-service.spec.ts --watch=false
```

Expected: PASS, 16 tests.

- [ ] **Step 5: Write the failing test for `ValidateBox`**

`src/app/ui/validate-box.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { MicrophoneService } from '../platform/microphone';
import { SpeechRecognizer } from '../platform/speech-recognition';
import { SafeStorage } from '../platform/storage';
import { ValidationService } from '../validation/validation-service';
import { ValidateBox } from './validate-box';

function render() {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: SafeStorage, useValue: { read: () => null, write: () => {} } },
      { provide: SpeechRecognizer, useValue: { supported: () => true, recognize: () => ({ start() {}, stop() {}, abort() {} }) } },
      { provide: MicrophoneService, useValue: { denied: () => false, ensure: () => Promise.resolve({}), markDenied() {}, release() {} } },
    ],
  });
  const fixture = TestBed.createComponent(ValidateBox);
  fixture.detectChanges();
  return {
    fixture,
    host: fixture.nativeElement as HTMLElement,
    validation: TestBed.inject(ValidationService),
  };
}

describe('ValidateBox', () => {
  it('renders as <div class="validate-box"> with the three slots', () => {
    const { host } = render();
    expect(host.classList.contains('validate-box')).toBe(true);
    expect(host.querySelector('.mic-dot')).not.toBeNull();
    expect(host.querySelector('.transcript')).not.toBeNull();
    expect(host.querySelector('.stars')).not.toBeNull();
  });

  it('shows the live transcript', () => {
    const { fixture, host, validation } = render();
    validation.begin(0, 'hit the road');
    fixture.detectChanges();
    expect(host.querySelector('.transcript')?.textContent).toContain('Listening');
  });

  it('renders filled and empty stars for a rating', () => {
    const { fixture, host, validation } = render();
    validation.stars.set(3);
    fixture.detectChanges();
    expect(host.querySelector('.stars')?.textContent).toBe('★★★☆☆');
  });

  it('renders no stars when there is no rating', () => {
    const { host } = render();
    expect(host.querySelector('.stars')?.textContent).toBe('');
  });

  it('renders five filled stars for a perfect repeat', () => {
    const { fixture, host, validation } = render();
    validation.stars.set(5);
    fixture.detectChanges();
    expect(host.querySelector('.stars')?.textContent).toBe('★★★★★');
  });

  it('renders five empty stars for a zero rating', () => {
    const { fixture, host, validation } = render();
    validation.stars.set(0);
    fixture.detectChanges();
    expect(host.querySelector('.stars')?.textContent).toBe('☆☆☆☆☆');
  });
});
```

- [ ] **Step 6: Run it to confirm it fails**

```bash
npm test -- --include src/app/ui/validate-box.spec.ts --watch=false
```

Expected: FAIL — cannot resolve `./validate-box`.

- [ ] **Step 7: Implement `validate-box.ts`**

`src/app/ui/validate-box.ts`:

```ts
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ValidationService } from '../validation/validation-service';

const MAX_STARS = 5;

/** The inline validator result, rendered as a sibling of the current line. */
@Component({
  selector: 'div[appValidateBox]',
  host: { class: 'validate-box' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="mic-dot"></span>
    <span class="transcript">{{ validation.transcript() }}</span>
    <span class="stars">{{ starText() }}</span>
  `,
})
export class ValidateBox {
  protected readonly validation = inject(ValidationService);

  /** Filled then empty stars, or nothing at all when unrated. */
  protected readonly starText = computed(() => {
    const n = this.validation.stars();
    if (n === null) { return ''; }
    return '★'.repeat(n) + '☆'.repeat(MAX_STARS - n);
  });
}
```

- [ ] **Step 8: Run it to confirm it passes**

```bash
npm test -- --include src/app/ui/validate-box.spec.ts --watch=false
```

Expected: PASS, 6 tests.

- [ ] **Step 9: Mount the box in `line-list.ts`**

The box must be a child of `.lines`, immediately after the current `<p>` — that is what `.validate-box`'s margins assume.

Replace the template in `src/app/ui/line-list.ts` and add the imports:

```ts
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { PlaybackService } from '../playback/playback-service';
import { PracticeStore } from '../state/practice-store';
import { SettingsStore } from '../state/settings-store';
import { ValidationService } from '../validation/validation-service';
import { ProgressRing } from './progress-ring';
import { ValidateBox } from './validate-box';

@Component({
  selector: 'div[appLineList]',
  imports: [ProgressRing, ValidateBox],
  host: {
    class: 'lines',
    id: 'lines',
    '[class.blurred]': 'settings.blur()',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (line of practice.lines(); track $index) {
      <p
        [class.current]="$index === practice.index()"
        [class.spoken]="practice.spoken().has($index)"
        (click)="playback.playLine($index)"
      ><span class="num">{{ $index + 1 }}</span><span
          class="text"
          [innerHTML]="line"
        ></span>@if ($index === practice.index() && playback.inGap()) {<svg
          appProgressRing
          [progress]="playback.progress()"
        ></svg>}</p>
      @if ($index === validation.lineIndex()) {
        <div appValidateBox></div>
      }
    }
  `,
})
export class LineList {
  protected readonly practice = inject(PracticeStore);
  protected readonly settings = inject(SettingsStore);
  protected readonly playback = inject(PlaybackService);
  protected readonly validation = inject(ValidationService);
}
```

- [ ] **Step 10: Gate the validate button behind the microphone prompt**

In `src/app/ui/transport-controls.ts`, replace the validate button's click handler and add the service:

```ts
      (click)="toggleValidate()"
```

and in the class:

```ts
  private readonly validation = inject(ValidationService);

  /**
   * Turning the validator on asks for the microphone first, so the first line
   * does not lose its gap to a permission prompt. A refusal leaves it off.
   */
  protected toggleValidate(): void {
    if (this.settings.sttEnabled()) {
      this.validation.disable();
    } else {
      void this.validation.enable();
    }
  }
```

Add `import { ValidationService } from '../validation/validation-service';`.

- [ ] **Step 11: Attach the hook and release the mic on unload**

In `src/app/app-startup.ts`, inject `ValidationService` and `SettingsStore`, then add to `run()` before `this.debug.install()`:

```ts
    // The gap races this promise, so a quick repeat advances early.
    this.playback.setValidationHook((lineIndex, plainText) =>
      this.settings.sttEnabled() ? this.validation.begin(lineIndex, plainText) : null,
    );

    // Never hold the microphone open past the page's life.
    const release = () => this.mic.release();
    addEventListener('pagehide', release);
    addEventListener('beforeunload', release);
```

Add the two injections:

```ts
  private readonly validation = inject(ValidationService);
  private readonly mic = inject(MicrophoneService);
```

with `import { MicrophoneService } from './platform/microphone';` and
`import { ValidationService } from './validation/validation-service';`.

`PlaybackService` calls `dispose()` at the end of each gap through its own `finally`, so add that too — in `runGap`'s `finally` block, after `this.progress.set(0)`, the service has no knowledge of validation. Instead, wrap the hook so disposal is the hook owner's job:

```ts
    this.playback.setValidationHook((lineIndex, plainText) => {
      if (!this.settings.sttEnabled()) { return null; }
      const done = this.validation.begin(lineIndex, plainText);
      // Whether the gap ended on the timer or on recognition, close the session.
      return done?.finally(() => this.validation.dispose()) ?? null;
    });
```

- [ ] **Step 12: Run the unit suite**

```bash
npm test -- --watch=false
```

Expected: 234 Vitest tests pass.

- [ ] **Step 13: Confirm the validator did not disturb parity**

```bash
npm run test:e2e
```

Expected: all 15 specs still PASS. The validator is off by default, so nothing in the suite exercises it; a failure here means the `LineList` template change broke the line structure.

- [ ] **Step 14: Commit**

```bash
git add -A
git commit -m "feat: speech validator and microphone flow

ValidationService drives one recognition session per gap and returns a promise
PlaybackService races against the gap timer, so a quick repeat advances early.
The inline box shows the live transcript and a 0-5 star rating.

Enabling the validator prompts for the microphone up front rather than stealing
the first line's gap, concurrent enables share one prompt, and a denial latches
for the session with a single warning. The mic is released on pagehide and
beforeunload.

All 15 Playwright specs still pass.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 12: Delete the vanilla app and cut CI over

The final commit. Removes the old app, points CI at the Angular build, and updates the README.

**Files:**
- Delete: `index.html`, `css/style.css`, `css/`, `js/app.js`, `js/core.js`, `js/stt.js`, `js/`, `data/data.js`, `data/`, `tools/convert-corpus.js`
- Modify: `.github/workflows/ci.yml`, `README.md`, `.gitignore`

**Interfaces:**
- Consumes: everything. Nothing depends on this task.
- Produces: a single-app repo deploying `dist/shadowing/browser` to GitHub Pages.

- [ ] **Step 1: Confirm nothing still references the vanilla files**

```bash
grep -rn "js/core\|js/stt\|js/app\|data/data\.js\|css/style\.css" \
  --include="*.ts" --include="*.json" --include="*.yml" --include="*.md" \
  . --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=docs
```

Expected: no matches. If `tools/convert-corpus.js` shows up, that is fine — it is deleted in the next step.

- [ ] **Step 2: Delete the vanilla app**

`src/app/data/corpus.ts` is now the corpus of record; the converter has no input left.

```bash
git rm -r index.html css js data tools
```

- [ ] **Step 3: Verify the Angular app still builds and passes**

```bash
npm test -- --watch=false && npx ng build && npm run test:e2e
```

Expected: 234 Vitest tests pass; the build succeeds; all 15 Playwright specs pass. Nothing here depended on the deleted files.

- [ ] **Step 4: Rewrite the CI workflow**

`.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [ main, master ]
  pull_request:
    branches: [ main, master ]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  test:
    timeout-minutes: 30
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v5

    - uses: actions/setup-node@v5
      with:
        node-version: lts/*
        cache: npm

    - name: Install dependencies
      run: npm ci

    - name: Install Playwright Chromium
      run: npx playwright install --with-deps chromium

    - name: Run unit tests
      run: npm test -- --watch=false

    - name: Run Playwright tests
      run: npx playwright test

    - uses: actions/upload-artifact@v6
      if: ${{ !cancelled() }}
      with:
        name: playwright-report
        path: |
          playwright-report/
          test-results/
        retention-days: 30

  deploy:
    needs: test
    if: ${{ (github.event_name == 'push' && github.ref == 'refs/heads/master') || github.event_name == 'workflow_dispatch' }}
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v5

    - uses: actions/setup-node@v5
      with:
        node-version: lts/*
        cache: npm

    - name: Install dependencies
      run: npm ci

    # A relative base href serves correctly from both / locally and
    # /Shadowing/ on GitHub Pages. The app has no routing, so there is no
    # deep-link concern.
    - name: Build
      run: npx ng build --base-href ./

    - uses: actions/configure-pages@v6

    - name: Upload site artifact
      uses: actions/upload-pages-artifact@v5
      with:
        path: dist/shadowing/browser

    - name: Deploy to GitHub Pages
      uses: actions/deploy-pages@v5
```

- [ ] **Step 5: Verify the production build serves from a subpath**

```bash
npx ng build --base-href ./
npx http-server dist/shadowing/browser -p 4300 --silent &
sleep 2
curl -sf http://localhost:4300/ | grep -q 'app-root' && echo "serves OK"
curl -sf http://localhost:4300/ | grep -q 'cloudflareinsights' && echo "beacon present"
kill %1
```

Expected: `serves OK` and `beacon present`.

- [ ] **Step 6: Rewrite the README**

`README.md`:

```markdown
# Shadowing

A tool to practice **shadowing** and **chunking** — two well-known techniques for learning English.

- **Chunking**: break sentences into natural chunks and listen to how words group together in real English rhythm.
- **Shadowing**: listen to a sentence and repeat it right after, matching the speaker's pronunciation and speed.

Try it online: https://fsandrade.github.io/Shadowing/

## Development

An Angular 22 single-page app. Zoneless, standalone components, signal-based state.

```bash
npm install
npm start          # ng serve on http://localhost:4200
npm test           # Vitest unit tests
npm run test:e2e   # Playwright end-to-end tests
npm run build      # production build into dist/shadowing/browser
```

## Layout

| Path | Responsibility |
| --- | --- |
| `src/app/core/` | Pure functions — text, decks, shuffle, timing, voice choice, STT scoring. No Angular imports. |
| `src/app/data/` | The corpus: 24 decks, 2242 sentences, as a typed module. |
| `src/app/platform/` | Web APIs behind injection tokens — storage, clock, speech synthesis, speech recognition, microphone. |
| `src/app/state/` | Signal stores. `SettingsStore` owns everything that persists; the rest own transient state. |
| `src/app/playback/` | The speak → gap → advance loop, with generation-based cancellation. |
| `src/app/validation/` | Speech validator: one recognition session per gap, rated 0–5 stars. |
| `src/app/ui/` | Presentational components. Attribute selectors keep the DOM flat so the global stylesheet's layout selectors apply. |
| `src/styles.css` | The only stylesheet. No component declares its own styles. |

## Corpus

`src/app/data/corpus.ts` is generated from Anki cards by `scripts/build.ps1`, which is
not part of this repo. That script enforces a `<b>`-only tag whitelist at build time —
the invariant that makes the corpus safe to render as markup.
`src/app/data/corpus.spec.ts` asserts the same property on the committed data.
```

- [ ] **Step 7: Tidy `.gitignore`**

The `scripts/` and `docs/*` entries stay. Remove nothing else; `dist/` and `.angular/` were added in Task 1. Confirm the final file reads:

```
scripts/
docs/*
!docs/superpowers/

# Playwright
node_modules/
/test-results/
/playwright-report/
/blob-report/
/playwright/.cache/
/playwright/.auth/

# Angular
dist/
.angular/
```

- [ ] **Step 8: Final full verification**

```bash
npm ci && npm test -- --watch=false && npx ng build --base-href ./ && npm run test:e2e
```

Expected: clean install; 234 Vitest tests pass; build succeeds; all 15 Playwright specs pass.

- [ ] **Step 9: Confirm no file in `src/app/` has grown unwieldy**

```bash
find src/app -name "*.ts" -not -name "*.spec.ts" -not -name "corpus.ts" \
  -exec wc -l {} + | sort -rn | head -12
```

Expected: every file under ~150 lines. `corpus.ts` is excluded — it is generated data.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "chore: delete the vanilla app and deploy the Angular build

Removes index.html, css/, js/, data/ and the corpus converter. CI now builds
with ng build --base-href ./ and publishes dist/shadowing/browser, replacing
the mkdir _site && cp step; the relative base href serves from both / locally
and /Shadowing/ on Pages.

The 843-line js/app.js is gone. All 15 Playwright specs pass unchanged against
the Angular build, and unit coverage is up from 61 assertions to 234.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Success criteria

- All 15 Playwright specs pass against the Angular build, with only `APP_URL` changed.
- ~234 Vitest tests pass, up from 61 node assertions.
- The published site behaves identically to the current one, Cloudflare beacon included.
- `src/styles.css` differs from the original `css/style.css` by exactly one rule.
- No file in `src/app/` exceeds ~150 lines.

## Self-review notes

- **Spec coverage:** §1 `ui/` layer → Tasks 7–11. §2 data flow → `AppStartup` (Task 8) for the bootstrap order and the 250 ms ticker. §4 error handling — the remaining UI-attached entries all land here: STT error codes and the mic denial latch (Task 11), keyboard guards (Task 9), `synth.resume()` keepalive and the clock tick (Task 8), `pagehide`/`beforeunload` release (Task 11). §5 testing tiers 3–4 → component specs throughout, plus the untouched Playwright suite. §6 build/deploy → Task 7 (`webServer`) and Task 12 (`--base-href ./`, Pages artifact). §7 sequence steps 7a–7e and 8 → Tasks 7–12.
- **Spec 2 assignment:** the spec index lists it under Task 8, since it needs both `BannerView` and the disabled transport, which arrive together there.
- **Deliberate deviation from the spec's slice plan:** the spec put the validator in slice 7e; here it is Task 11, after the parity gate is met in Task 10. Reaching all-15-green before adding untested-by-e2e behavior makes the gate cleaner, and Task 11 Step 13 re-checks parity afterwards.
- **`MESSAGES` consumers:** every string defined in Part 1 Task 5 is now consumed — `speechUnsupported`/`noEnglishVoice` in `AppStartup`, `deadVoice`/`sessionSummary` in `PlaybackService`, and `micDenied`/`listening`/`noSpeechDetected`/`micDeniedInline`/`couldNotListen` in `ValidationService`.
- **Known ambiguity resolved inline:** Task 9 Step 5 offers `hostDirectives` and a plain attribute binding on `.app`, and explicitly directs the implementer to the second. Task 11 Step 11 similarly settles where validator disposal lives — in the hook wrapper, not inside `PlaybackService`.
