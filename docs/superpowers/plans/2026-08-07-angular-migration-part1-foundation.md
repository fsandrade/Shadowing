# Angular Migration Part 1 — Headless Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up an Angular 22 workspace in the repo and port all of Shadowing's logic — pure helpers, corpus, Web API adapters, signal stores, and the playback engine — into tested, headless TypeScript, while the existing vanilla app keeps running and deploying untouched.

**Architecture:** Six layers, bottom-up, each testable without the one above it: `core/` (pure functions, no Angular), `data/` (typed corpus), `platform/` (Web APIs behind injection tokens), `state/` (signal stores, one per concern), `playback/` (the async loop with injected clock and speaker). No UI in this plan. The vanilla `index.html` / `css/` / `js/` stay on disk and remain what CI deploys.

**Tech Stack:** Angular 22.1, TypeScript, Vitest via `@angular/build:unit-test`, zoneless change detection, standalone components, Playwright 1.62 (unchanged in this plan).

## Global Constraints

- **Strict behavior parity.** No observable behavior change. Same `localStorage` keys, same JSON shape, same timings, same copy — including the Portuguese banner strings, which are carried over verbatim.
- **Angular 22.1.x.** Scaffold with `@angular/cli@22`. Node 24 (`lts/*` in CI).
- **Angular defaults:** standalone, zoneless, Vitest test runner, CSS, 2025 file-naming (`app.ts`, not `app.component.ts`), no routing.
- **`localStorage` keys:** `shadowing.settings` and `shadowing.edgeTip`. The settings JSON key for the validator is **`stt`**, not `sttEnabled` — existing users have this on disk.
- **`core/` imports nothing from Angular.** Enforced by review: no `@angular/*` import may appear in `src/app/core/`.
- **The vanilla app keeps working after every task in this plan.** `npm run test:e2e` must stay green throughout; it still points at `file://index.html`.
- **Every task ends on a commit** with the full suite green.
- **No file in `src/app/` exceeds ~150 lines.**
- **Reference spec:** `docs/superpowers/specs/2026-08-07-angular-migration-design.md`.

---

### Task 1: Angular workspace scaffolded alongside the vanilla app

Creates the Angular workspace in the repo root without disturbing the vanilla app or its tests. Ends with `ng build` and `ng test` both working on generated defaults, while `npm test` and `npm run test:e2e` still exercise the old app.

**Files:**
- Create: `angular.json`, `tsconfig.json`, `tsconfig.app.json`, `tsconfig.spec.json`, `vitest.config.ts`
- Create: `src/main.ts`, `src/index.html`, `src/styles.css`, `src/app/app.ts`, `src/app/app.html`, `src/app/app.config.ts`
- Modify: `package.json` (merge Angular deps and scripts into the existing file)
- Modify: `.gitignore` (add `dist/`, `.angular/`)
- Untouched: `index.html`, `css/`, `js/`, `data/`, `tests/`

**Interfaces:**
- Consumes: nothing.
- Produces: a working `ng build` / `ng test`; `src/styles.css` as the global stylesheet; `npm run test:unit` as the Angular unit-test command.

- [ ] **Step 1: Scaffold into a scratch directory**

The repo root already has `package.json` and `index.html`, which `ng new` refuses to overwrite. Generate outside the repo, then copy in.

```bash
cd /c/Sources
npx -y @angular/cli@22 new shadowing-scaffold \
  --style=css \
  --no-routing \
  --skip-git \
  --skip-install \
  --test-runner=vitest \
  --zoneless \
  --standalone
```

- [ ] **Step 2: Copy the workspace files into the repo**

```bash
cd /c/Sources/shadowing-scaffold
cp -r src angular.json tsconfig.json tsconfig.app.json tsconfig.spec.json /c/Sources/Shadowing/
cp package.json /c/Sources/Shadowing/package.angular.json
cd /c/Sources/Shadowing
ls src/app
```

Expected: `app.ts`, `app.html`, `app.css`, `app.spec.ts`, `app.config.ts` (exact set may vary slightly by patch version; that is fine).

- [ ] **Step 3: Merge `package.angular.json` into `package.json`**

Take Angular's `dependencies` and `devDependencies` verbatim, then re-add the two Playwright entries the repo already had. Keep `"type": "commonjs"` for now — the legacy `node --test` files in `tests/` use `require()`, and they are deleted incrementally in Tasks 2–4.

`package.json`:

```json
{
  "name": "shadowing",
  "version": "1.0.0",
  "description": "Practice shadowing and chunking to learn English.",
  "license": "ISC",
  "type": "commonjs",
  "scripts": {
    "start": "ng serve",
    "build": "ng build",
    "test": "node --test tests/core.test.js tests/data.test.js tests/stt.test.js",
    "test:unit": "ng test",
    "test:e2e": "playwright test"
  },
  "dependencies": {
    "@angular/common": "^22.1.0",
    "@angular/compiler": "^22.1.0",
    "@angular/core": "^22.1.0",
    "@angular/forms": "^22.1.0",
    "@angular/platform-browser": "^22.1.0",
    "rxjs": "~7.8.0",
    "tslib": "^2.3.0"
  },
  "devDependencies": {
    "@angular/build": "^22.1.0",
    "@angular/cli": "^22.1.0",
    "@angular/compiler-cli": "^22.1.0",
    "@playwright/test": "^1.62.1",
    "@types/node": "^26.1.2",
    "jsdom": "^28.0.0",
    "typescript": "~5.9.0",
    "vitest": "^4.0.0"
  }
}
```

Copy the exact version strings from `package.angular.json` where they differ from the above — Angular's generated file is authoritative for its own packages.

- [ ] **Step 4: Delete the scratch directory and the merge artifact**

```bash
rm -rf /c/Sources/shadowing-scaffold /c/Sources/Shadowing/package.angular.json
```

- [ ] **Step 5: Install**

```bash
cd /c/Sources/Shadowing && npm install
```

Expected: completes without peer-dependency errors.

- [ ] **Step 6: Move the stylesheet in and add the one required rule**

`src/styles.css` must be `css/style.css` verbatim, plus one rule. The `<app-root>` element sits between `<body>` and `<header>`, which would break `body { display: grid; grid-template-rows: auto 1fr }`.

```bash
cp css/style.css src/styles.css
```

Then append to `src/styles.css`:

```css

/* Angular host pass-through ---------------------------------------------- */
/* <app-root> must not become a grid item of body; the header/.app rows
   below it are what body's `grid-template-rows: auto 1fr` targets. */
app-root { display: contents; }
```

- [ ] **Step 7: Point `angular.json` at the global stylesheet and set the output name**

In `angular.json`, under `projects.<name>.architect.build.options`, confirm:

```json
{
  "outputPath": "dist/shadowing",
  "index": "src/index.html",
  "browser": "src/main.ts",
  "styles": ["src/styles.css"]
}
```

Delete `src/app/app.css` and remove the `styleUrl` line from `src/app/app.ts` — per the spec, no component declares its own styles.

- [ ] **Step 8: Put the Cloudflare beacon into `src/index.html`**

Copy the tag verbatim from `index.html:8` so analytics survives the cutover:

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Shadowing</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <base href="/">
  <script type='module' src='https://static.cloudflareinsights.com/beacon.min.js' data-cf-beacon='{"token": "d954907b6a1d4094bdee8d47c1fc871a"}'></script>
</head>
<body>
  <app-root></app-root>
</body>
</html>
```

- [ ] **Step 9: Add build output to `.gitignore`**

Append:

```
# Angular
dist/
.angular/
```

- [ ] **Step 10: Verify the Angular unit runner works**

```bash
npm run test:unit
```

Expected: PASS — the generated `src/app/app.spec.ts` runs.

**If this fails with a module-format error**, `"type": "commonjs"` is the cause. Fallback: rename the three legacy test files to `.cjs`, update their `require` paths, drop `"type"` from `package.json`, and set `"test": "node --test tests/*.test.cjs"`. Record which path was taken in the commit message.

- [ ] **Step 11: Verify the Angular build works**

```bash
npx ng build
```

Expected: succeeds, writes `dist/shadowing/browser/`.

- [ ] **Step 12: Verify the vanilla app is undisturbed**

```bash
npm test && npm run test:e2e
```

Expected: 61 node assertions pass (one skipped); 15 Playwright specs pass. These still run against `file://index.html`.

- [ ] **Step 13: Commit**

```bash
git add -A
git commit -m "chore: scaffold Angular 22 workspace alongside the vanilla app

Adds angular.json, tsconfig files, src/ and the Vitest runner. src/styles.css
is css/style.css verbatim plus one app-root { display: contents } rule, needed
because <app-root> would otherwise become a grid item of body.

The vanilla app is untouched and still what CI deploys; npm test and
npm run test:e2e are unchanged and green.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: `core/` — pure functions ported with their tests

Ports all of `js/core.js` into six focused TypeScript modules with zero Angular imports, and translates all 42 assertions from `tests/core.test.js` to Vitest. This is the layer everything else is built on.

**Files:**
- Create: `src/app/core/text.ts`, `src/app/core/deck.ts`, `src/app/core/shuffle.ts`, `src/app/core/timing.ts`, `src/app/core/voice.ts`, `src/app/core/scoring.ts`
- Create: `src/app/core/text.spec.ts`, `src/app/core/deck.spec.ts`, `src/app/core/shuffle.spec.ts`, `src/app/core/timing.spec.ts`, `src/app/core/voice.spec.ts`, `src/app/core/scoring.spec.ts`
- Delete: `tests/core.test.js`
- Modify: `package.json` (drop `core.test.js` from the `test` script)
- Reference: `js/core.js`, `tests/core.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `stripTags(html: string): string`
  - `Deck`, `Corpus`, `DeckOption` interfaces; `deckOptions(corpus: Corpus): DeckOption[]`; `linesFor(corpus: Corpus, deckId: string): string[]`
  - `Rng = () => number`; `shuffle<T>(list: readonly T[], rng?: Rng): T[]`
  - `pauseMs(speechMs: number, slack: number): number`; `safetyTimeoutMs(text: string, rate: number): number`; `nextIndex(i: number, len: number): number`; `formatClock(seconds: number): string`
  - `VoiceLike { name: string; lang: string }`; `isEnglish(v: VoiceLike): boolean`; `pickVoice<T extends VoiceLike>(voices: readonly T[], preferredName?: string): T | null`; `hasEnglishVoice(voices: readonly VoiceLike[]): boolean`
  - `normalizeSpeech(text: unknown): string[]`; `wordSimilarity(base: string, transcript: string): number`; `starsFor(base: string, transcript: string): number | null`

- [ ] **Step 1: Write the failing tests for `text.ts`**

`src/app/core/text.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { stripTags } from './text';

describe('stripTags', () => {
  it('removes the chunk highlight and leaves the sentence', () => {
    expect(stripTags("I must've <b>hit the snooze button</b> like four times."))
      .toBe("I must've hit the snooze button like four times.");
  });

  it('is a no-op on plain text', () => {
    expect(stripTags('no markup here')).toBe('no markup here');
  });

  it('keeps stripping when a tag straddles another tag', () => {
    const out = stripTags('<sc<script>ript>alert(1)</sc<script>ript>');
    expect(out).not.toContain('<');
    expect(out).not.toContain('>');
    expect(out.toLowerCase()).not.toContain('script');
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

```bash
npm run test:unit -- --include src/app/core/text.spec.ts --watch=false
```

Expected: FAIL — cannot resolve `./text`.

- [ ] **Step 3: Implement `text.ts`**

The depth-counting loop is deliberate: it is what makes the nested-tag case safe. Do not replace it with a regex.

`src/app/core/text.ts`:

```ts
/**
 * Strips every angle-bracketed span from `html`, counting nesting depth so a
 * tag hidden inside another tag cannot reassemble. This is the guard that makes
 * the corpus safe to render as markup.
 */
export function stripTags(html: string): string {
  const s = String(html);
  let depth = 0;
  let out = '';
  for (const ch of s) {
    if (ch === '<') { depth++; continue; }
    if (ch === '>' && depth > 0) { depth--; continue; }
    if (depth === 0) { out += ch; }
  }
  return out;
}
```

- [ ] **Step 4: Run it to confirm it passes**

```bash
npm run test:unit -- --include src/app/core/text.spec.ts --watch=false
```

Expected: PASS, 3 tests.

- [ ] **Step 5: Write the failing tests for `deck.ts`**

`src/app/core/deck.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { type Corpus, deckOptions, linesFor } from './deck';

const DATA: Corpus = {
  generatedAt: '2026-08-06T00:00:00Z',
  decks: [
    { id: 'daily-life', name: 'Daily Life', lines: ['a <b>one</b>', 'b two'] },
    { id: 'meetings', name: 'Meetings', lines: ['c three'] },
  ],
};

describe('deckOptions', () => {
  it('puts All first with the grand total', () => {
    expect(deckOptions(DATA)[0]).toEqual({ id: 'all', name: 'All', count: 3 });
  });

  it('lists the decks in data order with their counts', () => {
    expect(deckOptions(DATA).slice(1)).toEqual([
      { id: 'daily-life', name: 'Daily Life', count: 2 },
      { id: 'meetings', name: 'Meetings', count: 1 },
    ]);
  });
});

describe('linesFor', () => {
  it('returns one deck', () => {
    expect(linesFor(DATA, 'meetings')).toEqual(['c three']);
  });

  it('concatenates every deck in order for "all"', () => {
    expect(linesFor(DATA, 'all')).toEqual(['a <b>one</b>', 'b two', 'c three']);
  });

  it('returns an empty list for an unknown deck', () => {
    expect(linesFor(DATA, 'nope')).toEqual([]);
  });

  it('does not hand back the internal array', () => {
    linesFor(DATA, 'meetings').push('mutated');
    expect(DATA.decks[1].lines.length).toBe(1);
  });
});
```

- [ ] **Step 6: Run it to confirm it fails**

```bash
npm run test:unit -- --include src/app/core/deck.spec.ts --watch=false
```

Expected: FAIL — cannot resolve `./deck`.

- [ ] **Step 7: Implement `deck.ts`**

`src/app/core/deck.ts`:

```ts
export interface Deck {
  readonly id: string;
  readonly name: string;
  readonly lines: readonly string[];
}

export interface Corpus {
  readonly generatedAt: string;
  readonly decks: readonly Deck[];
}

export interface DeckOption {
  readonly id: string;
  readonly name: string;
  readonly count: number;
}

export const ALL_DECK_ID = 'all';

/** The sidebar's list: a synthetic "All" entry, then every deck in data order. */
export function deckOptions(corpus: Corpus): DeckOption[] {
  const decks = corpus?.decks ?? [];
  const total = decks.reduce((n, d) => n + d.lines.length, 0);
  return [
    { id: ALL_DECK_ID, name: 'All', count: total },
    ...decks.map((d) => ({ id: d.id, name: d.name, count: d.lines.length })),
  ];
}

/** Always returns a fresh array, so callers may shuffle it in place. */
export function linesFor(corpus: Corpus, deckId: string): string[] {
  const decks = corpus?.decks ?? [];
  if (deckId === ALL_DECK_ID) {
    return decks.flatMap((d) => [...d.lines]);
  }
  const deck = decks.find((d) => d.id === deckId);
  return deck ? [...deck.lines] : [];
}
```

- [ ] **Step 8: Run it to confirm it passes**

```bash
npm run test:unit -- --include src/app/core/deck.spec.ts --watch=false
```

Expected: PASS, 6 tests.

- [ ] **Step 9: Write the failing tests for `shuffle.ts`**

`src/app/core/shuffle.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { shuffle } from './shuffle';

/** Feeds a fixed sequence, repeating the last value once exhausted. */
function seq(values: number[]): () => number {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
}

describe('shuffle', () => {
  it('keeps every element exactly once', () => {
    const input = [1, 2, 3, 4, 5];
    expect([...shuffle(input)].sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it('returns a new array and leaves the input alone', () => {
    const input = ['a', 'b', 'c'];
    const out = shuffle(input);
    expect(out).not.toBe(input);
    expect(input).toEqual(['a', 'b', 'c']);
  });

  it('applies the rng to the algorithm, not just the input', () => {
    // rng() === 0 always: each i swaps with index 0, rotating the list.
    expect(shuffle([1, 2, 3], seq([0]))).toEqual([3, 1, 2]);
  });

  it('produces different permutations for different rng sequences', () => {
    const a = shuffle([1, 2, 3, 4], seq([0]));
    const b = shuffle([1, 2, 3, 4], seq([0.99]));
    expect(a).not.toEqual(b);
  });

  it('guards against rng returning exactly 1.0', () => {
    expect([...shuffle([1, 2, 3], seq([1]))].sort()).toEqual([1, 2, 3]);
  });

  it('handles the empty list', () => {
    expect(shuffle([])).toEqual([]);
  });
});
```

- [ ] **Step 10: Run it to confirm it fails**

```bash
npm run test:unit -- --include src/app/core/shuffle.spec.ts --watch=false
```

Expected: FAIL — cannot resolve `./shuffle`.

- [ ] **Step 11: Implement `shuffle.ts`**

The `Math.min(..., i)` clamp is the guard against an `rng` that returns exactly `1.0`, which would otherwise index out of bounds.

`src/app/core/shuffle.ts`:

```ts
export type Rng = () => number;

/** Fisher–Yates on a copy. `rng` is injectable so shuffling is testable. */
export function shuffle<T>(list: readonly T[], rng: Rng = Math.random): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.min(Math.floor(rng() * (i + 1)), i);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
```

- [ ] **Step 12: Run it to confirm it passes**

```bash
npm run test:unit -- --include src/app/core/shuffle.spec.ts --watch=false
```

Expected: PASS, 6 tests.

- [ ] **Step 13: Write the failing tests for `timing.ts`**

`src/app/core/timing.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { formatClock, nextIndex, pauseMs, safetyTimeoutMs } from './timing';

describe('pauseMs', () => {
  it('is the speech duration times the slack', () => {
    expect(pauseMs(1000, 1.5)).toBe(1500);
  });

  it('rounds to whole milliseconds', () => {
    expect(pauseMs(1000, 1.0005)).toBe(1001);
  });

  it('never returns a negative wait', () => {
    expect(pauseMs(1000, -2)).toBe(0);
  });
});

describe('safetyTimeoutMs', () => {
  it('allows the sentence plus a five second margin', () => {
    expect(safetyTimeoutMs('123456789012', 1)).toBe(6000);
  });

  it('grows as the rate slows down', () => {
    expect(safetyTimeoutMs('123456789012', 0.5)).toBeGreaterThan(
      safetyTimeoutMs('123456789012', 1),
    );
  });

  it('still gives an empty string the margin', () => {
    expect(safetyTimeoutMs('', 1)).toBe(5000);
  });
});

describe('nextIndex', () => {
  it('wraps at the end of the list', () => {
    expect(nextIndex(0, 3)).toBe(1);
    expect(nextIndex(2, 3)).toBe(0);
  });

  it('returns 0 for an empty list', () => {
    expect(nextIndex(0, 0)).toBe(0);
  });
});

describe('formatClock', () => {
  it('renders MM:SS', () => {
    expect(formatClock(0)).toBe('00:00');
    expect(formatClock(65)).toBe('01:05');
  });

  it('clamps negatives to zero', () => {
    expect(formatClock(-30)).toBe('00:00');
  });

  it('keeps counting in minutes past an hour', () => {
    expect(formatClock(3661)).toBe('61:01');
  });
});
```

- [ ] **Step 14: Run it to confirm it fails**

```bash
npm run test:unit -- --include src/app/core/timing.spec.ts --watch=false
```

Expected: FAIL — cannot resolve `./timing`.

- [ ] **Step 15: Implement `timing.ts`**

`src/app/core/timing.ts`:

```ts
/** The repeat-aloud gap: as long as the sentence took, scaled by the slack slider. */
export function pauseMs(speechMs: number, slack: number): number {
  return Math.max(0, Math.round(speechMs * slack));
}

/**
 * Ceiling on how long we will wait for an utterance to report `end`. Some voices
 * never fire it, so this is what keeps the playback loop from stalling forever.
 */
export function safetyTimeoutMs(text: string, rate: number): number {
  return Math.round((String(text).length / 12 / rate + 5) * 1000);
}

/** Advances with wraparound; 0 for an empty list. */
export function nextIndex(i: number, len: number): number {
  return len > 0 ? (i + 1) % len : 0;
}

/** MM:SS, clamped at zero, minutes not rolled into hours. */
export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}
```

- [ ] **Step 16: Run it to confirm it passes**

```bash
npm run test:unit -- --include src/app/core/timing.spec.ts --watch=false
```

Expected: PASS, 11 tests.

- [ ] **Step 17: Write the failing tests for `voice.ts`**

`src/app/core/voice.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { hasEnglishVoice, pickVoice, type VoiceLike } from './voice';

const v = (name: string, lang: string): VoiceLike => ({ name, lang });

const VOICES = [
  v('Maria', 'pt-BR'),
  v('Aria Natural', 'en-US'),
  v('David', 'en-US'),
  v('Sonia', 'en-GB'),
];

describe('pickVoice', () => {
  it('honours a remembered voice by name', () => {
    expect(pickVoice(VOICES, 'Sonia')?.name).toBe('Sonia');
  });

  it('falls through when the remembered voice is gone', () => {
    expect(pickVoice(VOICES, 'Nobody')?.name).toBe('Aria Natural');
  });

  it('prefers a Natural en-US voice', () => {
    expect(pickVoice(VOICES)?.name).toBe('Aria Natural');
  });

  it('falls back to any en-US voice', () => {
    expect(pickVoice([v('Maria', 'pt-BR'), v('David', 'en-US')])?.name).toBe('David');
  });

  it('falls back to any English voice', () => {
    expect(pickVoice([v('Maria', 'pt-BR'), v('Sonia', 'en-GB')])?.name).toBe('Sonia');
  });

  it('falls back to the first voice when no English one exists', () => {
    expect(pickVoice([v('Maria', 'pt-BR'), v('Ines', 'pt-PT')])?.name).toBe('Maria');
  });

  it('returns null when there are no voices at all', () => {
    expect(pickVoice([])).toBeNull();
  });
});

describe('hasEnglishVoice', () => {
  it('detects the presence of an en-* voice', () => {
    expect(hasEnglishVoice(VOICES)).toBe(true);
    expect(hasEnglishVoice([v('Maria', 'pt-BR')])).toBe(false);
    expect(hasEnglishVoice([])).toBe(false);
  });
});
```

- [ ] **Step 18: Run it to confirm it fails**

```bash
npm run test:unit -- --include src/app/core/voice.spec.ts --watch=false
```

Expected: FAIL — cannot resolve `./voice`.

- [ ] **Step 19: Implement `voice.ts`**

`src/app/core/voice.ts`:

```ts
/** The subset of SpeechSynthesisVoice this module needs, so tests need no DOM. */
export interface VoiceLike {
  readonly name: string;
  readonly lang: string;
}

export function isEnglish(v: VoiceLike): boolean {
  return /^en/i.test(v.lang ?? '');
}

/**
 * Preference order: the remembered voice, then a Natural en-US voice (Edge's
 * best), then any en-US, then any English, then whatever exists.
 */
export function pickVoice<T extends VoiceLike>(
  voices: readonly T[],
  preferredName = '',
): T | null {
  if (!voices.length) { return null; }
  const byName = preferredName
    ? voices.find((v) => v.name === preferredName)
    : undefined;
  if (byName) { return byName; }

  const naturalUs = voices.find(
    (v) => /^en-US$/i.test(v.lang ?? '') && /natural/i.test(v.name ?? ''),
  );
  if (naturalUs) { return naturalUs; }

  const us = voices.find((v) => /^en-US$/i.test(v.lang ?? ''));
  if (us) { return us; }

  return voices.find(isEnglish) ?? voices[0];
}

export function hasEnglishVoice(voices: readonly VoiceLike[]): boolean {
  return voices.some(isEnglish);
}
```

- [ ] **Step 20: Run it to confirm it passes**

```bash
npm run test:unit -- --include src/app/core/voice.spec.ts --watch=false
```

Expected: PASS, 8 tests.

- [ ] **Step 21: Write the failing tests for `scoring.ts`**

`src/app/core/scoring.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { normalizeSpeech, starsFor, wordSimilarity } from './scoring';

describe('normalizeSpeech', () => {
  it('lowercases, strips punctuation and collapses apostrophes', () => {
    expect(normalizeSpeech("I MUST'VE hit it, right?"))
      .toEqual(['i', 'mustve', 'hit', 'it', 'right']);
  });

  it('handles null, numbers and collapsed whitespace', () => {
    expect(normalizeSpeech(null)).toEqual([]);
    expect(normalizeSpeech(undefined)).toEqual([]);
    expect(normalizeSpeech(42)).toEqual(['42']);
    expect(normalizeSpeech('  a   b  ')).toEqual(['a', 'b']);
  });
});

describe('wordSimilarity', () => {
  it('is 1 for identical text and 0 for disjoint text', () => {
    expect(wordSimilarity('hit the road', 'hit the road')).toBe(1);
    expect(wordSimilarity('hit the road', 'zebra quilt fjord')).toBe(0);
  });

  it('ignores punctuation, case and spacing', () => {
    expect(wordSimilarity('Hit the road!', 'hit   the road')).toBe(1);
  });

  it('scores a missing tail word below 1', () => {
    const sim = wordSimilarity('hit the road jack', 'hit the road');
    expect(sim).toBeGreaterThan(0);
    expect(sim).toBeLessThan(1);
  });

  it('handles empties', () => {
    expect(wordSimilarity('', '')).toBe(1);
    expect(wordSimilarity('hello', '')).toBe(0);
    expect(wordSimilarity('', 'hello')).toBe(0);
  });
});

describe('starsFor', () => {
  it('gives 5 stars on an exact match and null on silence', () => {
    expect(starsFor('hit the road', 'hit the road')).toBe(5);
    expect(starsFor('hit the road', '')).toBeNull();
    expect(starsFor('hit the road', '   ')).toBeNull();
  });

  it('maps similarity to the approved thresholds', () => {
    // 0 words of 4 shared -> sim 0 -> 0 stars
    expect(starsFor('one two three four', 'alpha beta gamma delta')).toBe(0);
    // 3 of 4 shared -> sim 2*3/8 = 0.75 -> 3 stars
    expect(starsFor('one two three four', 'one two three delta')).toBe(3);
  });
});
```

- [ ] **Step 22: Run it to confirm it fails**

```bash
npm run test:unit -- --include src/app/core/scoring.spec.ts --watch=false
```

Expected: FAIL — cannot resolve `./scoring`.

- [ ] **Step 23: Implement `scoring.ts`**

`src/app/core/scoring.ts`:

```ts
/** Words only: lowercase, apostrophes dropped, everything else a separator. */
export function normalizeSpeech(text: unknown): string[] {
  return String(text ?? '')
    .toLowerCase()
    .replace(/'/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Dice coefficient over the longest common subsequence of words, so word order
 * counts but a dropped or added word degrades the score gracefully.
 * Returns 1 for two empty inputs and 0 when only one side is empty.
 */
export function wordSimilarity(base: string, transcript: string): number {
  const a = normalizeSpeech(base);
  const b = normalizeSpeech(transcript);
  if (!a.length && !b.length) { return 1; }
  if (!a.length || !b.length) { return 0; }

  const dp: number[][] = Array.from({ length: a.length + 1 }, () =>
    new Array<number>(b.length + 1).fill(0),
  );
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1] + 1
        : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return (2 * dp[a.length][b.length]) / (a.length + b.length);
}

/** 0–5 stars, or null when nothing was said. Thresholds are product-approved. */
export function starsFor(base: string, transcript: string): number | null {
  if (!normalizeSpeech(transcript).length) { return null; }
  const sim = wordSimilarity(base, transcript);
  if (sim < 0.45) { return 0; }
  if (sim < 0.60) { return 1; }
  if (sim < 0.70) { return 2; }
  if (sim < 0.80) { return 3; }
  if (sim < 0.95) { return 4; }
  return 5;
}
```

- [ ] **Step 24: Run it to confirm it passes**

```bash
npm run test:unit -- --include src/app/core/scoring.spec.ts --watch=false
```

Expected: PASS, 8 tests.

- [ ] **Step 25: Confirm `core/` is Angular-free**

```bash
grep -rn "@angular" src/app/core/ || echo "clean: no Angular imports in core/"
```

Expected: `clean: no Angular imports in core/`.

- [ ] **Step 26: Retire the legacy core tests**

All 42 assertions now live in `src/app/core/*.spec.ts`.

```bash
rm tests/core.test.js
```

In `package.json`, change the `test` script to:

```json
"test": "node --test tests/data.test.js tests/stt.test.js"
```

- [ ] **Step 27: Run the whole suite**

```bash
npm run test:unit -- --watch=false && npm test && npm run test:e2e
```

Expected: 42 Vitest tests pass; the remaining node tests pass; 15 Playwright specs pass.

- [ ] **Step 28: Commit**

```bash
git add -A
git commit -m "refactor: port core.js to six typed modules under src/app/core

stripTags, deckOptions/linesFor, shuffle, timing, voice selection and STT
scoring become focused modules with no Angular imports, so they test without
TestBed. All 42 assertions from tests/core.test.js are translated to Vitest;
the old file is removed.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: `data/corpus.ts` — the corpus as a typed module

Converts `data/data.js` into a generated TypeScript module, with the corpus-integrity assertions that still apply after the move. Three assertions from `tests/data.test.js` are deliberately dropped — they constrain the generated file's *encoding*, which no longer applies to a TS source file.

**Files:**
- Create: `tools/convert-corpus.js` (one-shot generator, kept for re-runs)
- Create: `src/app/data/corpus.ts` (generated, ~2400 lines)
- Create: `src/app/data/corpus.spec.ts`
- Delete: `tests/data.test.js`
- Modify: `package.json` (drop `data.test.js` from the `test` script)
- Reference: `data/data.js`, `tests/data.test.js`

**Interfaces:**
- Consumes: `Corpus` from `src/app/core/deck.ts` (Task 2).
- Produces: `CORPUS: Corpus` from `src/app/data/corpus.ts` — 24 decks in file order, 2242 lines.

- [ ] **Step 1: Write the converter**

`tools/convert-corpus.js` (CommonJS — `package.json` still has `"type": "commonjs"`):

```js
/**
 * One-shot generator: data/data.js -> src/app/data/corpus.ts
 *
 * Loads the legacy global-assigning script under a window shim and re-emits it
 * as a typed TS module. Kept in the repo so the corpus can be regenerated if
 * data/data.js is refreshed before the vanilla app is deleted.
 */
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
global.window = {};
require(path.join(root, 'data', 'data.js'));
const data = global.window.SHADOWING;

if (!data || !Array.isArray(data.decks)) {
  throw new Error('data/data.js did not define window.SHADOWING.decks');
}

const out = `// GENERATED FILE - do not edit by hand.
// Regenerate with: node tools/convert-corpus.js
import type { Corpus } from '../core/deck';

export const CORPUS: Corpus = ${JSON.stringify(data, null, 2)};
`;

const dest = path.join(root, 'src', 'app', 'data', 'corpus.ts');
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, out, 'utf8');

const total = data.decks.reduce((n, d) => n + d.lines.length, 0);
console.log(`wrote ${dest}: ${data.decks.length} decks, ${total} lines`);
```

- [ ] **Step 2: Run the converter**

```bash
node tools/convert-corpus.js
```

Expected: `wrote .../corpus.ts: 24 decks, 2242 lines`.

- [ ] **Step 3: Write the corpus tests**

Six of the nine legacy assertions survive. `deckOptions`/`linesFor` are already covered in Task 2 against a fixture; these guard the real data.

`src/app/data/corpus.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { CORPUS } from './corpus';

const EXPECTED: ReadonlyArray<readonly [string, string, number]> = [
  ['daily-life', 'Daily Life', 135],
  ['small-talk', 'Small Talk', 87],
  ['native-fillers-conversation-glue', 'Native Fillers & Conversation Glue', 126],
  ['work-office', 'Work / Office', 123],
  ['tech-software-development', 'Tech / Software Development', 114],
  ['meetings', 'Meetings', 99],
  ['making-plans', 'Making Plans', 75],
  ['socializing', 'Socializing', 69],
  ['problem-solving', 'Problem Solving', 78],
  ['emotions-opinions', 'Emotions & Opinions', 90],
  ['gym-fitness', 'Gym & Fitness', 57],
  ['travel', 'Travel', 72],
  ['restaurants', 'Restaurants', 48],
  ['shopping', 'Shopping', 57],
  ['job-interview', 'Job Interview', 102],
  ['doctor-health', 'At the Doctor / Health & Appointments', 102],
  ['weather-seasons', 'Weather & Seasons', 102],
  ['groceries-supermarket', 'Groceries & Supermarket', 102],
  ['directions-transport', 'Getting Around / Directions', 102],
  ['hobbies-free-time', 'Hobbies & Free Time', 102],
  ['banking-money', 'Banking & Money', 99],
  ['customer-service', 'Customer Service & Tech Support', 103],
  ['renting-housing', 'Renting & Housing', 99],
  ['school-learning', 'School & Learning', 99],
];

const allLines = CORPUS.decks.flatMap((d) => d.lines);

it('exposes generatedAt as an ISO-ish UTC stamp', () => {
  expect(CORPUS.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
});

it('has the 24 decks in file order with the right names and counts', () => {
  expect(CORPUS.decks.length).toBe(EXPECTED.length);
  CORPUS.decks.forEach((deck, i) => {
    const [id, name, count] = EXPECTED[i];
    expect(deck.id, `deck ${i} id`).toBe(id);
    expect(deck.name, `deck ${i} name`).toBe(name);
    expect(deck.lines.length, `deck ${id} line count`).toBe(count);
  });
});

it('has 2242 lines in total', () => {
  expect(allLines.length).toBe(2242);
});

describe('markup safety', () => {
  // This whitelist is the invariant that makes rendering the corpus as markup
  // safe. Angular's [innerHTML] additionally routes through DomSanitizer, but
  // the corpus itself must stay clean.
  it('contains no tag other than <b> and </b>', () => {
    for (const deck of CORPUS.decks) {
      for (const line of deck.lines) {
        for (const tag of line.match(/<[^>]*>/g) ?? []) {
          expect(tag, `unexpected tag in ${deck.id}: ${line}`).toMatch(/^<\/?b>$/);
        }
      }
    }
  });
});

it('has no line that is empty once tags are stripped', () => {
  for (const deck of CORPUS.decks) {
    for (const line of deck.lines) {
      expect(line.replace(/<[^>]*>/g, '').trim().length, `empty line in ${deck.id}`)
        .toBeGreaterThan(0);
    }
  }
});

it('keeps the highlighted chunk: most lines carry a <b> pair', () => {
  const withBold = allLines.filter((l) => l.includes('<b>')).length;
  expect(withBold).toBeGreaterThan(2000);
});
```

- [ ] **Step 4: Run the corpus tests**

```bash
npm run test:unit -- --include src/app/data/corpus.spec.ts --watch=false
```

Expected: PASS, 6 tests.

- [ ] **Step 5: Retire the legacy data tests**

```bash
rm tests/data.test.js
```

In `package.json`:

```json
"test": "node --test tests/stt.test.js"
```

- [ ] **Step 6: Record the dropped assertions and the out-of-repo follow-up**

Append to `README.md`:

```markdown
## Corpus

`src/app/data/corpus.ts` is generated. Regenerate with:

```bash
node tools/convert-corpus.js
```

The upstream generator (`scripts/build.ps1`, gitignored and not part of this
repo) still emits the legacy `data/data.js`. It must be updated to write
`src/app/data/corpus.ts` directly, or the corpus becomes hand-maintained.
Its build-time `<b>`-only tag whitelist is the invariant that keeps the corpus
safe to render as markup; `src/app/data/corpus.spec.ts` asserts the same
property on the committed data.
```

- [ ] **Step 7: Run the whole suite**

```bash
npm run test:unit -- --watch=false && npm test && npm run test:e2e
```

Expected: 48 Vitest tests pass; `stt.test.js` passes; 15 Playwright specs pass.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "refactor: generate src/app/data/corpus.ts from data/data.js

The corpus becomes a statically imported typed module instead of a global
assigned by a script tag. tools/convert-corpus.js regenerates it.

Six of nine assertions from tests/data.test.js carry over, including the
<b>-only tag whitelist. Three are dropped as no longer meaningful: two
asserted the generated file was pure ASCII with \\u escapes, and one shelled
out to the gitignored scripts/build.ps1 (already skipped in CI). README now
records that the upstream generator needs updating.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: `platform/` — Web APIs behind injection tokens

Every `window` reference in `js/app.js` becomes an injectable seam. This is the task that makes the rest of the app testable. Ports `tests/stt.test.js` and retires the last legacy node test.

**Files:**
- Create: `src/app/platform/storage.ts`, `src/app/platform/clock.ts`, `src/app/platform/speech-synthesis.ts`, `src/app/platform/speaker.ts`, `src/app/platform/speech-recognition.ts`, `src/app/platform/microphone.ts`
- Create: `src/app/platform/storage.spec.ts`, `src/app/platform/clock.spec.ts`, `src/app/platform/speaker.spec.ts`, `src/app/platform/speech-recognition.spec.ts`, `src/app/platform/microphone.spec.ts`
- Delete: `tests/stt.test.js`
- Modify: `package.json` (`test` becomes `ng test`; drop `"type": "commonjs"`)
- Reference: `js/stt.js`, `js/app.js:189-213` (speak), `js/app.js:322-345` (mic), `js/app.js:733-751` (storage)

**Interfaces:**
- Consumes: `safetyTimeoutMs` from `src/app/core/timing.ts`.
- Produces:
  - `STORAGE: InjectionToken<Storage | null>`; `SafeStorage` with `read<T>(key: string): T | null` and `write(key: string, value: unknown): void`
  - `Clock` with `now(): number`, `ticks(): number`, `wait(ms: number, until?: Promise<void>): PendingWait`; `PendingWait { done: Promise<void>; resolveNow(): void }`
  - `SPEECH_SYNTHESIS: InjectionToken<SpeechSynthesis>`
  - `Speaker` with `speak(text: string, opts: SpeakOptions): Promise<void>`, `cancel(): void`, `keepAlive(): void`, `voices(): SpeechSynthesisVoice[]`, `onVoicesChanged(fn: () => void): void`, `supported: boolean`; `SpeakOptions { rate: number; voice: SpeechSynthesisVoice | null }`
  - `SpeechRecognizer` with `supported(): boolean` and `recognize(opts: RecognitionOptions): RecognitionSession`; `RecognitionOptions { lang?: string; onInterim?(t: string): void; onResult?(t: string): void; onError?(code: string | null): void }`; `RecognitionSession { start(): void; stop(): void; abort(): void }`
  - `MicrophoneService` with `denied: Signal<boolean>`, `ensure(): Promise<MediaStream | null>`, `release(): void`

- [ ] **Step 1: Write the failing tests for `SafeStorage`**

`src/app/platform/storage.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SafeStorage, STORAGE } from './storage';

function withStorage(impl: Partial<Storage>) {
  TestBed.configureTestingModule({
    providers: [{ provide: STORAGE, useValue: impl as Storage }],
  });
  return TestBed.inject(SafeStorage);
}

describe('SafeStorage', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('round-trips a JSON value', () => {
    const map = new Map<string, string>();
    const s = withStorage({
      getItem: (k) => map.get(k) ?? null,
      setItem: (k, v) => void map.set(k, v),
    });
    s.write('k', { a: 1 });
    expect(s.read<{ a: number }>('k')).toEqual({ a: 1 });
  });

  it('returns null for a missing key', () => {
    expect(withStorage({ getItem: () => null }).read('nope')).toBeNull();
  });

  it('returns null for unparseable JSON instead of throwing', () => {
    expect(withStorage({ getItem: () => '{not json' }).read('k')).toBeNull();
  });

  it('swallows a throwing setItem (private mode)', () => {
    const s = withStorage({
      getItem: () => null,
      setItem: () => { throw new DOMException('QuotaExceeded'); },
    });
    expect(() => s.write('k', 1)).not.toThrow();
  });

  it('swallows a throwing getItem', () => {
    const s = withStorage({ getItem: () => { throw new Error('blocked'); } });
    expect(s.read('k')).toBeNull();
  });

  it('reads null when no storage is available at all', () => {
    TestBed.configureTestingModule({ providers: [{ provide: STORAGE, useValue: null }] });
    const s = TestBed.inject(SafeStorage);
    expect(s.read('k')).toBeNull();
    expect(() => s.write('k', 1)).not.toThrow();
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

```bash
npm run test:unit -- --include src/app/platform/storage.spec.ts --watch=false
```

Expected: FAIL — cannot resolve `./storage`.

- [ ] **Step 3: Implement `storage.ts`**

`src/app/platform/storage.ts`:

```ts
import { inject, Injectable, InjectionToken } from '@angular/core';

/**
 * `localStorage` is absent in some embeddings and throws on access in others
 * (Safari private mode), so it is resolved lazily and may be null.
 */
export const STORAGE = new InjectionToken<Storage | null>('STORAGE', {
  providedIn: 'root',
  factory: () => {
    try {
      return typeof localStorage === 'undefined' ? null : localStorage;
    } catch {
      return null;
    }
  },
});

/** JSON-in, JSON-out storage that never throws. */
@Injectable({ providedIn: 'root' })
export class SafeStorage {
  private readonly store = inject(STORAGE);

  read<T>(key: string): T | null {
    try {
      const raw = this.store?.getItem(key);
      return raw === null || raw === undefined ? null : (JSON.parse(raw) as T);
    } catch {
      return null;
    }
  }

  write(key: string, value: unknown): void {
    try {
      this.store?.setItem(key, JSON.stringify(value));
    } catch {
      /* private mode, quota, or no storage: settings are a nice-to-have */
    }
  }
}
```

- [ ] **Step 4: Run it to confirm it passes**

```bash
npm run test:unit -- --include src/app/platform/storage.spec.ts --watch=false
```

Expected: PASS, 6 tests.

- [ ] **Step 5: Write the failing tests for `Clock`**

`src/app/platform/clock.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Clock } from './clock';

describe('Clock', () => {
  let clock: Clock;

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.resetTestingModule();
    clock = TestBed.inject(Clock);
  });

  afterEach(() => vi.useRealTimers());

  it('resolves after the requested delay', async () => {
    const pending = clock.wait(500);
    let settled = false;
    void pending.done.then(() => { settled = true; });

    await vi.advanceTimersByTimeAsync(499);
    expect(settled).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    expect(settled).toBe(true);
  });

  it('resolveNow settles early and cancels the timer', async () => {
    const pending = clock.wait(5000);
    let settled = false;
    void pending.done.then(() => { settled = true; });

    pending.resolveNow();
    await Promise.resolve();
    expect(settled).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('resolves when the `until` promise wins the race', async () => {
    let release!: () => void;
    const until = new Promise<void>((r) => { release = r; });
    const pending = clock.wait(5000, until);
    let settled = false;
    void pending.done.then(() => { settled = true; });

    release();
    await vi.advanceTimersByTimeAsync(0);
    expect(settled).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('ignores a late `until` once the timer already fired', async () => {
    let release!: () => void;
    const until = new Promise<void>((r) => { release = r; });
    const pending = clock.wait(100, until);
    let count = 0;
    void pending.done.then(() => { count++; });

    await vi.advanceTimersByTimeAsync(100);
    release();
    await vi.advanceTimersByTimeAsync(0);
    expect(count).toBe(1);
  });

  it('resolveNow after settling is a no-op', async () => {
    const pending = clock.wait(10);
    let count = 0;
    void pending.done.then(() => { count++; });
    await vi.advanceTimersByTimeAsync(10);
    pending.resolveNow();
    await Promise.resolve();
    expect(count).toBe(1);
  });
});
```

- [ ] **Step 6: Run it to confirm it fails**

```bash
npm run test:unit -- --include src/app/platform/clock.spec.ts --watch=false
```

Expected: FAIL — cannot resolve `./clock`.

- [ ] **Step 7: Implement `clock.ts`**

`src/app/platform/clock.ts`:

```ts
import { Injectable } from '@angular/core';

export interface PendingWait {
  /** Settles once, whichever of delay / `until` / `resolveNow` comes first. */
  readonly done: Promise<void>;
  /** Ends the wait immediately. Used by the playback loop's cancellation. */
  resolveNow(): void;
}

/**
 * The single source of time for the app. Injected so the playback loop and the
 * session timer can be driven by fake timers instead of real ones.
 */
@Injectable({ providedIn: 'root' })
export class Clock {
  /** Wall clock, for session accounting. */
  now(): number {
    return Date.now();
  }

  /** Monotonic, for measuring how long an utterance actually took. */
  ticks(): number {
    return performance.now();
  }

  /**
   * Waits `ms`, unless `until` resolves first (the speech-validator race) or
   * `resolveNow()` is called (a transport control interrupting the gap).
   */
  wait(ms: number, until?: Promise<void>): PendingWait {
    let settle!: () => void;
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const done = new Promise<void>((resolve) => {
      settle = () => {
        if (settled) { return; }
        settled = true;
        clearTimeout(timer);
        resolve();
      };
    });

    timer = setTimeout(settle, ms);
    void until?.then(settle);

    return { done, resolveNow: settle };
  }
}
```

- [ ] **Step 8: Run it to confirm it passes**

```bash
npm run test:unit -- --include src/app/platform/clock.spec.ts --watch=false
```

Expected: PASS, 5 tests.

- [ ] **Step 9: Write the failing tests for `Speaker`**

`src/app/platform/speaker.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Speaker } from './speaker';
import { SPEECH_SYNTHESIS, UTTERANCE_FACTORY } from './speech-synthesis';

class FakeUtterance {
  lang = '';
  rate = 1;
  voice: SpeechSynthesisVoice | null = null;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(public text: string) {}
}

function setup(overrides: Partial<SpeechSynthesis> = {}) {
  const spoken: FakeUtterance[] = [];
  const synth = {
    speak: vi.fn((u: unknown) => void spoken.push(u as FakeUtterance)),
    cancel: vi.fn(),
    resume: vi.fn(),
    getVoices: vi.fn(() => [] as SpeechSynthesisVoice[]),
    addEventListener: vi.fn(),
    speaking: false,
    paused: false,
    ...overrides,
  } as unknown as SpeechSynthesis;

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: SPEECH_SYNTHESIS, useValue: synth },
      { provide: UTTERANCE_FACTORY, useValue: (t: string) => new FakeUtterance(t) },
    ],
  });
  return { speaker: TestBed.inject(Speaker), synth, spoken };
}

describe('Speaker', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('cancels any in-flight utterance before speaking', async () => {
    const { speaker, synth } = setup();
    void speaker.speak('hello', { rate: 1, voice: null });
    expect(synth.cancel).toHaveBeenCalledOnce();
    expect(synth.speak).toHaveBeenCalledOnce();
  });

  it('applies rate, en-US lang and the chosen voice', () => {
    const voice = { name: 'David', lang: 'en-US' } as SpeechSynthesisVoice;
    const { speaker, spoken } = setup();
    void speaker.speak('hello', { rate: 1.4, voice });
    expect(spoken[0].text).toBe('hello');
    expect(spoken[0].lang).toBe('en-US');
    expect(spoken[0].rate).toBe(1.4);
    expect(spoken[0].voice).toBe(voice);
  });

  it('resolves on end', async () => {
    const { speaker, spoken } = setup();
    let settled = false;
    void speaker.speak('hello', { rate: 1, voice: null }).then(() => { settled = true; });
    spoken[0].onend?.();
    await Promise.resolve();
    expect(settled).toBe(true);
  });

  it('resolves on error', async () => {
    const { speaker, spoken } = setup();
    let settled = false;
    void speaker.speak('hello', { rate: 1, voice: null }).then(() => { settled = true; });
    spoken[0].onerror?.();
    await Promise.resolve();
    expect(settled).toBe(true);
  });

  it('resolves via the safety timeout when the voice never reports end', async () => {
    const { speaker } = setup();
    let settled = false;
    // 12 chars at rate 1 -> safetyTimeoutMs === 6000
    void speaker.speak('123456789012', { rate: 1, voice: null })
      .then(() => { settled = true; });

    await vi.advanceTimersByTimeAsync(5999);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(settled).toBe(true);
  });

  it('resolves exactly once when end and the timeout both fire', async () => {
    const { speaker, spoken } = setup();
    let count = 0;
    void speaker.speak('123456789012', { rate: 1, voice: null }).then(() => { count++; });
    spoken[0].onend?.();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(count).toBe(1);
  });

  it('resolves immediately when utterances are unavailable', async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: SPEECH_SYNTHESIS, useValue: setup().synth },
        { provide: UTTERANCE_FACTORY, useValue: null },
      ],
    });
    const speaker = TestBed.inject(Speaker);
    await expect(speaker.speak('hello', { rate: 1, voice: null })).resolves.toBeUndefined();
  });

  it('keepAlive resumes only while speaking and not already paused', () => {
    const a = setup({ speaking: true, paused: false });
    a.speaker.keepAlive();
    expect(a.synth.resume).toHaveBeenCalledOnce();

    const b = setup({ speaking: true, paused: true });
    b.speaker.keepAlive();
    expect(b.synth.resume).not.toHaveBeenCalled();

    const c = setup({ speaking: false, paused: false });
    c.speaker.keepAlive();
    expect(c.synth.resume).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 10: Run it to confirm it fails**

```bash
npm run test:unit -- --include src/app/platform/speaker.spec.ts --watch=false
```

Expected: FAIL — cannot resolve `./speaker`.

- [ ] **Step 11: Implement `speech-synthesis.ts`**

Both tokens resolve `window` lazily inside their factory. That is what keeps the Playwright `installFakeAudio` init script working: it patches `window.speechSynthesis` and `window.SpeechSynthesisUtterance` before navigation, and injection happens after.

`src/app/platform/speech-synthesis.ts`:

```ts
import { InjectionToken } from '@angular/core';

/** A no-op stand-in so the app runs where speech synthesis is absent. */
const NOOP_SYNTH: SpeechSynthesis = {
  getVoices: () => [],
  speak: () => {},
  cancel: () => {},
  pause: () => {},
  resume: () => {},
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => false,
  speaking: false,
  paused: false,
  pending: false,
  onvoiceschanged: null,
} as unknown as SpeechSynthesis;

export const SPEECH_SYNTHESIS = new InjectionToken<SpeechSynthesis>('SPEECH_SYNTHESIS', {
  providedIn: 'root',
  factory: () =>
    (typeof window !== 'undefined' && window.speechSynthesis) || NOOP_SYNTH,
});

/** Whether the platform really supports speech, as opposed to the no-op above. */
export const SPEECH_SUPPORTED = new InjectionToken<boolean>('SPEECH_SUPPORTED', {
  providedIn: 'root',
  factory: () => typeof window !== 'undefined' && 'speechSynthesis' in window,
});

export type UtteranceFactory = ((text: string) => SpeechSynthesisUtterance) | null;

export const UTTERANCE_FACTORY = new InjectionToken<UtteranceFactory>('UTTERANCE_FACTORY', {
  providedIn: 'root',
  factory: (): UtteranceFactory => {
    if (typeof window === 'undefined' || !window.SpeechSynthesisUtterance) { return null; }
    return (text: string) => new window.SpeechSynthesisUtterance(text);
  },
});
```

- [ ] **Step 12: Implement `speaker.ts`**

`src/app/platform/speaker.ts`:

```ts
import { inject, Injectable } from '@angular/core';
import { safetyTimeoutMs } from '../core/timing';
import {
  SPEECH_SUPPORTED,
  SPEECH_SYNTHESIS,
  UTTERANCE_FACTORY,
} from './speech-synthesis';

export interface SpeakOptions {
  readonly rate: number;
  readonly voice: SpeechSynthesisVoice | null;
}

/** Speaks one sentence at a time and always settles, even for a mute voice. */
@Injectable({ providedIn: 'root' })
export class Speaker {
  private readonly synth = inject(SPEECH_SYNTHESIS);
  private readonly makeUtterance = inject(UTTERANCE_FACTORY);
  readonly supported = inject(SPEECH_SUPPORTED);

  voices(): SpeechSynthesisVoice[] {
    return this.synth.getVoices() ?? [];
  }

  onVoicesChanged(fn: () => void): void {
    this.synth.addEventListener('voiceschanged', fn);
  }

  /**
   * Resolves on `end`, on `error`, or after `safetyTimeoutMs` — whichever comes
   * first, exactly once. Some voices never fire `end`; without the timeout the
   * playback loop would stall forever.
   */
  speak(text: string, opts: SpeakOptions): Promise<void> {
    if (!this.makeUtterance) { return Promise.resolve(); }

    return new Promise<void>((resolve) => {
      let settled = false;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const finish = () => {
        if (settled) { return; }
        settled = true;
        clearTimeout(timer);
        resolve();
      };

      const u = this.makeUtterance!(text);
      u.lang = 'en-US';
      u.rate = opts.rate;
      if (opts.voice) { u.voice = opts.voice; }
      u.onend = finish;
      u.onerror = finish;
      timer = setTimeout(finish, safetyTimeoutMs(text, opts.rate));

      this.synth.cancel();
      this.synth.speak(u);
    });
  }

  cancel(): void {
    this.synth.cancel();
  }

  /** Chrome silently pauses long-lived synthesis; this pokes it awake. */
  keepAlive(): void {
    if (this.synth.speaking && !this.synth.paused) {
      this.synth.resume();
    }
  }
}
```

- [ ] **Step 13: Run it to confirm it passes**

```bash
npm run test:unit -- --include src/app/platform/speaker.spec.ts --watch=false
```

Expected: PASS, 8 tests.

- [ ] **Step 14: Write the failing tests for `SpeechRecognizer`**

Translates all 10 assertions from `tests/stt.test.js`.

`src/app/platform/speech-recognition.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  SPEECH_RECOGNITION_CTOR,
  SpeechRecognizer,
  type SpeechRecognitionCtor,
} from './speech-recognition';

class FakeRecognition {
  static last: FakeRecognition | null = null;
  lang = '';
  continuous: boolean | undefined;
  interimResults: boolean | undefined;
  maxAlternatives: number | undefined;
  onresult: ((e: unknown) => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;
  onend: (() => void) | null = null;
  started = false;
  stopped = false;
  aborted = false;
  constructor() { FakeRecognition.last = this; }
  start() { this.started = true; }
  stop() { this.stopped = true; }
  abort() { this.aborted = true; }
}

function fireResult(rec: FakeRecognition, transcript: string, isFinal: boolean) {
  rec.onresult?.({
    resultIndex: 0,
    results: [{ 0: { transcript }, isFinal, length: 1 }],
  });
}

function recognizer(ctor: SpeechRecognitionCtor | null) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [{ provide: SPEECH_RECOGNITION_CTOR, useValue: ctor }],
  });
  return TestBed.inject(SpeechRecognizer);
}

const Ctor = FakeRecognition as unknown as SpeechRecognitionCtor;

describe('SpeechRecognizer', () => {
  beforeEach(() => { FakeRecognition.last = null; });

  it('supported() is false when no recognition API exists', () => {
    expect(recognizer(null).supported()).toBe(false);
  });

  it('supported() is true when a recognition API exists', () => {
    expect(recognizer(Ctor).supported()).toBe(true);
  });

  it('recognize throws when no recognition API exists', () => {
    expect(() => recognizer(null).recognize({})).toThrow(/not available/i);
  });

  it('starts a one-shot interim session and reports onInterim', () => {
    const interim: string[] = [];
    const session = recognizer(Ctor).recognize({
      lang: 'pt-BR',
      onInterim: (t) => interim.push(t),
    });
    session.start();

    const rec = FakeRecognition.last!;
    expect(rec.started).toBe(true);
    expect(rec.lang).toBe('pt-BR');
    expect(rec.continuous).toBe(false);
    expect(rec.interimResults).toBe(true);
    expect(rec.maxAlternatives).toBe(1);

    fireResult(rec, 'hello ', false);
    expect(interim).toEqual(['hello ']);
  });

  it('defaults the language to en-US', () => {
    recognizer(Ctor).recognize({}).start();
    expect(FakeRecognition.last!.lang).toBe('en-US');
  });

  it('calls onResult once with the accumulated final text when recognition ends', () => {
    const results: string[] = [];
    recognizer(Ctor).recognize({ onResult: (t) => results.push(t) }).start();
    const rec = FakeRecognition.last!;

    fireResult(rec, 'hit the ', true);
    fireResult(rec, 'road', true);
    rec.onend?.();
    rec.onend?.();

    expect(results).toEqual(['hit the road']);
  });

  it('onResult receives an empty string when nothing was said', () => {
    const results: string[] = [];
    recognizer(Ctor).recognize({ onResult: (t) => results.push(t) }).start();
    FakeRecognition.last!.onend?.();
    expect(results).toEqual(['']);
  });

  it('onError forwards the API error code', () => {
    const codes: Array<string | null> = [];
    recognizer(Ctor).recognize({ onError: (c) => codes.push(c) }).start();
    FakeRecognition.last!.onerror?.({ error: 'not-allowed' });
    expect(codes).toEqual(['not-allowed']);
  });

  it('abort suppresses onend, onresult and onerror', () => {
    const seen: string[] = [];
    const session = recognizer(Ctor).recognize({
      onResult: () => seen.push('result'),
      onError: () => seen.push('error'),
    });
    session.start();
    session.abort();

    const rec = FakeRecognition.last!;
    expect(rec.aborted).toBe(true);
    rec.onend?.();
    rec.onerror?.({ error: 'aborted' });
    expect(seen).toEqual([]);
  });

  it('stop is graceful and does not abort', () => {
    const session = recognizer(Ctor).recognize({});
    session.start();
    session.stop();
    expect(FakeRecognition.last!.stopped).toBe(true);
    expect(FakeRecognition.last!.aborted).toBe(false);
  });

  it('reports a start failure through onError instead of throwing', () => {
    class Exploding extends FakeRecognition {
      override start(): never { throw new Error('already started'); }
    }
    const codes: Array<string | null> = [];
    const session = recognizer(Exploding as unknown as SpeechRecognitionCtor)
      .recognize({ onError: (c) => codes.push(c) });
    expect(() => session.start()).not.toThrow();
    expect(codes).toEqual(['already started']);
  });
});
```

- [ ] **Step 15: Run it to confirm it fails**

```bash
npm run test:unit -- --include src/app/platform/speech-recognition.spec.ts --watch=false
```

Expected: FAIL — cannot resolve `./speech-recognition`.

- [ ] **Step 16: Implement `speech-recognition.ts`**

`src/app/platform/speech-recognition.ts`:

```ts
import { inject, Injectable, InjectionToken } from '@angular/core';

export interface RecognitionOptions {
  readonly lang?: string;
  onInterim?(text: string): void;
  onResult?(finalText: string): void;
  onError?(code: string | null): void;
}

export interface RecognitionSession {
  start(): void;
  stop(): void;
  /** Ends the session and suppresses every remaining callback. */
  abort(): void;
}

/** Minimal shape of the Web Speech recognition object we drive. */
interface RecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: any) => void) | null;
  onerror: ((e: any) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

export type SpeechRecognitionCtor = new () => RecognitionLike;

export const SPEECH_RECOGNITION_CTOR =
  new InjectionToken<SpeechRecognitionCtor | null>('SPEECH_RECOGNITION_CTOR', {
    providedIn: 'root',
    factory: () => {
      const w = globalThis as Record<string, unknown>;
      return (w['SpeechRecognition'] ?? w['webkitSpeechRecognition'] ?? null) as
        SpeechRecognitionCtor | null;
    },
  });

@Injectable({ providedIn: 'root' })
export class SpeechRecognizer {
  private readonly ctor = inject(SPEECH_RECOGNITION_CTOR);

  supported(): boolean {
    return this.ctor !== null;
  }

  /** One-shot recognition with interim results. Throws if unsupported. */
  recognize(opts: RecognitionOptions): RecognitionSession {
    if (!this.ctor) {
      throw new Error('SpeechRecognition is not available in this browser.');
    }

    const rec = new this.ctor();
    rec.lang = opts.lang ?? 'en-US';
    rec.continuous = false;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    let ended = false;
    let finalText = '';

    rec.onresult = (event: any) => {
      let live = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript: string = result[0]?.transcript ?? '';
        if (result.isFinal) { finalText += transcript; } else { live += transcript; }
      }
      if (live) { opts.onInterim?.(finalText + live); }
    };

    rec.onerror = (event: any) => {
      if (ended) { return; }
      opts.onError?.(event?.error ?? null);
    };

    rec.onend = () => {
      if (ended) { return; }
      ended = true;
      opts.onResult?.(finalText);
    };

    return {
      start: () => {
        try {
          rec.start();
        } catch (e) {
          opts.onError?.((e as Error)?.message ?? 'recognition-start-failed');
        }
      },
      stop: () => {
        try { rec.stop(); } catch { /* already stopped */ }
      },
      abort: () => {
        if (ended) { return; }
        ended = true;
        try { rec.abort(); } catch { /* never started */ }
      },
    };
  }
}
```

- [ ] **Step 17: Run it to confirm it passes**

```bash
npm run test:unit -- --include src/app/platform/speech-recognition.spec.ts --watch=false
```

Expected: PASS, 11 tests.

- [ ] **Step 18: Write the failing tests for `MicrophoneService`**

These cover the denial latch and pending guard added in commit `bb87d69`.

`src/app/platform/microphone.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { MEDIA_DEVICES, MicrophoneService } from './microphone';

function fakeTrack() {
  return { stop: vi.fn() } as unknown as MediaStreamTrack;
}

function fakeStream(tracks: MediaStreamTrack[]) {
  return { getTracks: () => tracks } as unknown as MediaStream;
}

function setup(getUserMedia: MediaDevices['getUserMedia'] | null) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [{
      provide: MEDIA_DEVICES,
      useValue: getUserMedia ? ({ getUserMedia } as MediaDevices) : null,
    }],
  });
  return TestBed.inject(MicrophoneService);
}

describe('MicrophoneService', () => {
  it('resolves with the granted stream', async () => {
    const stream = fakeStream([fakeTrack()]);
    const mic = setup(vi.fn().mockResolvedValue(stream) as never);
    await expect(mic.ensure()).resolves.toBe(stream);
    expect(mic.denied()).toBe(false);
  });

  it('prompts only once and reuses the held stream', async () => {
    const stream = fakeStream([fakeTrack()]);
    const getUserMedia = vi.fn().mockResolvedValue(stream);
    const mic = setup(getUserMedia as never);
    await mic.ensure();
    await mic.ensure();
    expect(getUserMedia).toHaveBeenCalledOnce();
  });

  it('coalesces concurrent calls into one prompt', async () => {
    const stream = fakeStream([fakeTrack()]);
    const getUserMedia = vi.fn().mockResolvedValue(stream);
    const mic = setup(getUserMedia as never);
    await Promise.all([mic.ensure(), mic.ensure(), mic.ensure()]);
    expect(getUserMedia).toHaveBeenCalledOnce();
  });

  it('latches denial and never re-prompts', async () => {
    const getUserMedia = vi.fn().mockRejectedValue(new DOMException('NotAllowed'));
    const mic = setup(getUserMedia as never);

    await expect(mic.ensure()).rejects.toBeDefined();
    expect(mic.denied()).toBe(true);

    await expect(mic.ensure()).rejects.toBeDefined();
    expect(getUserMedia).toHaveBeenCalledOnce();
  });

  it('markDenied latches without a prompt, for an STT not-allowed error', async () => {
    const getUserMedia = vi.fn().mockResolvedValue(fakeStream([]));
    const mic = setup(getUserMedia as never);
    mic.markDenied();
    expect(mic.denied()).toBe(true);
    await expect(mic.ensure()).rejects.toBeDefined();
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it('resolves null when getUserMedia is unavailable', async () => {
    await expect(setup(null).ensure()).resolves.toBeNull();
  });

  it('release stops every track and allows a later prompt', async () => {
    const track = fakeTrack();
    const getUserMedia = vi.fn().mockResolvedValue(fakeStream([track]));
    const mic = setup(getUserMedia as never);

    await mic.ensure();
    mic.release();
    expect(track.stop).toHaveBeenCalledOnce();

    await mic.ensure();
    expect(getUserMedia).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 19: Run it to confirm it fails**

```bash
npm run test:unit -- --include src/app/platform/microphone.spec.ts --watch=false
```

Expected: FAIL — cannot resolve `./microphone`.

- [ ] **Step 20: Implement `microphone.ts`**

`src/app/platform/microphone.ts`:

```ts
import { inject, Injectable, InjectionToken, signal } from '@angular/core';

export const MEDIA_DEVICES = new InjectionToken<MediaDevices | null>('MEDIA_DEVICES', {
  providedIn: 'root',
  factory: () =>
    typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia
      ? navigator.mediaDevices
      : null,
});

/**
 * Holds one microphone grant for the session. Denial is a latch: once the user
 * says no, we never prompt again, because a second prompt on every line would
 * be hostile and browsers suppress it anyway.
 */
@Injectable({ providedIn: 'root' })
export class MicrophoneService {
  private readonly devices = inject(MEDIA_DEVICES);
  private readonly deniedState = signal(false);
  private stream: MediaStream | null = null;
  private pending: Promise<MediaStream | null> | null = null;

  readonly denied = this.deniedState.asReadonly();

  /** Rejects when denied; resolves with null where the API is absent. */
  ensure(): Promise<MediaStream | null> {
    if (this.deniedState()) { return Promise.reject(new Error('microphone-denied')); }
    if (this.stream) { return Promise.resolve(this.stream); }
    if (this.pending) { return this.pending; }
    if (!this.devices) { return Promise.resolve(null); }

    this.pending = this.devices.getUserMedia({ audio: true }).then(
      (stream) => {
        this.pending = null;
        this.stream = stream;
        return stream;
      },
      (err) => {
        this.pending = null;
        this.markDenied();
        throw err;
      },
    );
    return this.pending;
  }

  /** Latches denial without prompting — used when STT reports `not-allowed`. */
  markDenied(): void {
    this.deniedState.set(true);
  }

  release(): void {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
  }
}
```

- [ ] **Step 21: Run it to confirm it passes**

```bash
npm run test:unit -- --include src/app/platform/microphone.spec.ts --watch=false
```

Expected: PASS, 7 tests.

- [ ] **Step 22: Retire the last legacy node test and switch `npm test` to Vitest**

All of `tests/stt.test.js` now lives in `speech-recognition.spec.ts`.

```bash
rm tests/stt.test.js
```

In `package.json`, remove `"type": "commonjs"`, drop the now-empty `test:unit`, and make `test` the Angular runner:

```json
"scripts": {
  "start": "ng serve",
  "build": "ng build",
  "test": "ng test",
  "test:e2e": "playwright test"
}
```

`tools/convert-corpus.js` uses `require`. With `"type"` removed, Node treats `.js` as CommonJS by default, so it keeps working. Confirm in the next step.

- [ ] **Step 23: Verify everything**

```bash
node tools/convert-corpus.js && npm test -- --watch=false && npm run test:e2e
```

Expected: the converter still prints `24 decks, 2242 lines`; 85 Vitest tests pass; 15 Playwright specs pass against the still-untouched vanilla app.

- [ ] **Step 24: Commit**

```bash
git add -A
git commit -m "refactor: wrap Web APIs in injectable platform adapters

Storage, clock, speech synthesis, speech recognition and microphone access
each move behind an injection token, so the playback loop, session timer and
mic-permission flow become testable without a browser.

Ports all 10 assertions from tests/stt.test.js and adds coverage the vanilla
app could not reach: the safety timeout firing when a voice never reports end,
the microphone denial latch, and storage throwing in private mode.

npm test is now Vitest; the last legacy node --test file is gone.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: `state/` — signal stores, one per concern

Replaces the 29-field mutable `state` bag from `js/app.js:40-68`. Ownership rule from the spec: `SettingsStore` owns everything that persists; the other stores own only transient state and derive the rest. No value is writable from two places.

**Files:**
- Create: `src/app/state/settings-store.ts`, `src/app/state/practice-store.ts`, `src/app/state/session-timer-store.ts`, `src/app/state/banner-store.ts`, `src/app/state/voice-store.ts`
- Create: `src/app/state/settings-store.spec.ts`, `src/app/state/practice-store.spec.ts`, `src/app/state/session-timer-store.spec.ts`, `src/app/state/banner-store.spec.ts`, `src/app/state/voice-store.spec.ts`
- Create: `src/app/state/messages.ts` (all banner copy in one place)
- Reference: `js/app.js:40-68`, `js/app.js:226-235`, `js/app.js:582-620`, `js/app.js:733-751`

**Interfaces:**
- Consumes: `Corpus`/`deckOptions`/`linesFor`/`ALL_DECK_ID` (`core/deck.ts`), `shuffle`/`Rng` (`core/shuffle.ts`), `formatClock` (`core/timing.ts`), `pickVoice`/`hasEnglishVoice` (`core/voice.ts`), `CORPUS` (`data/corpus.ts`), `SafeStorage` (`platform/storage.ts`), `Clock` (`platform/clock.ts`), `Speaker` (`platform/speaker.ts`).
- Produces:
  - `SETTINGS_KEY = 'shadowing.settings'`; `SettingsStore` with signals `deckId`, `rate`, `slack`, `voiceName`, `durationMin`, `blur`, `sttEnabled` and setters `setDeckId`, `setRate`, `setSlack`, `setVoiceName`, `setDurationMin`, `setBlur`, `setSttEnabled`
  - `PracticeStore` with `index`, `playing`, `spoken`, computed `lines`, `deckOptions`, `hasLines`; methods `selectDeck(id)`, `goTo(i)`, `advance()`, `back()`, `markSpoken(i)`, `shuffleLines(rng?)`, `setPlaying(on)`
  - `SessionTimerStore` with `remainingMs`, `spokenCount`, computed `clockText`; methods `resume()`, `accrue(playing)`, `expired()`, `reset(minutes)`, `finish()`, `countSpoken()`, `tick()`
  - `BannerSource` union; `BannerStore` with `html`, `visible`; methods `show(html, source)`, `clear(source)`, `clearAll()`
  - `VoiceStore` with `voices`, computed `englishVoices`, `selected`, `hasEnglish`; method `refresh()`
  - `MESSAGES` constant object holding every banner string

- [ ] **Step 1: Create the message constants**

All banner copy lives in one file so the eventual language cleanup is a one-file change. Strings are **verbatim** from `js/app.js`, including the HTML entities and the Portuguese, per the strict-parity constraint.

`src/app/state/messages.ts`:

```ts
/**
 * Every banner string, copied verbatim from the vanilla app (js/app.js).
 * The mix of English and Portuguese is intentional for now: this migration is
 * parity-only. Normalizing the copy is a separate, single-file change.
 */
export const MESSAGES = {
  noEnglishVoice:
    'Nenhuma voz em ingl&ecirc;s instalada neste navegador. ' +
    'Instale uma voz en-US no Windows para praticar com &aacute;udio.',
  speechUnsupported:
    'Este navegador n&atilde;o suporta s&iacute;ntese de voz. ' +
    'As frases continuam vis&iacute;veis para leitura.',
  deadVoice:
    'A voz selecionada n&atilde;o est&aacute; produzindo &aacute;udio. ' +
    'Escolha outra voz no menu <b>voz</b> &mdash; vozes Natural exigem ' +
    'conex&atilde;o com a internet.',
  micDenied:
    'Microphone access was denied — the validator is off for this session. ' +
    'Allow the microphone and reload to use it.',
  sessionSummary: (minutes: number, spoken: number): string =>
    `Sess&atilde;o conclu&iacute;da: ${minutes} min &middot; ` +
    `${spoken}${spoken === 1 ? ' frase repetida.' : ' frases repetidas.'}`,
  listening: 'Listening…',
  noSpeechDetected: 'No speech detected',
  micDeniedInline: 'Microphone denied',
  couldNotListen: 'Could not listen — validation skipped',
} as const;
```

- [ ] **Step 2: Write the failing tests for `SettingsStore`**

`src/app/state/settings-store.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { SafeStorage } from '../platform/storage';
import { SETTINGS_KEY, SettingsStore } from './settings-store';

function setup(stored: unknown = null) {
  const write = vi.fn();
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [{
      provide: SafeStorage,
      useValue: { read: () => stored, write } satisfies Pick<SafeStorage, 'read' | 'write'>,
    }],
  });
  return { store: TestBed.inject(SettingsStore), write };
}

describe('SettingsStore defaults', () => {
  it('falls back to the vanilla defaults with nothing stored', () => {
    const { store } = setup(null);
    expect(store.deckId()).toBe('all');
    expect(store.rate()).toBe(1);
    expect(store.slack()).toBe(1);
    expect(store.voiceName()).toBe('');
    expect(store.durationMin()).toBe(0);
    expect(store.blur()).toBe(false);
    expect(store.sttEnabled()).toBe(false);
  });

  it('restores stored values', () => {
    const { store } = setup({
      deckId: 'meetings', rate: 1.4, slack: 2, voiceName: 'David',
      durationMin: 10, blur: true, stt: true,
    });
    expect(store.deckId()).toBe('meetings');
    expect(store.rate()).toBe(1.4);
    expect(store.slack()).toBe(2);
    expect(store.voiceName()).toBe('David');
    expect(store.durationMin()).toBe(10);
    expect(store.blur()).toBe(true);
    expect(store.sttEnabled()).toBe(true);
  });

  it('coerces a zero or unparseable rate to 1, matching Number(x) || 1', () => {
    expect(setup({ rate: 0 }).store.rate()).toBe(1);
    expect(setup({ rate: 'nope' }).store.rate()).toBe(1);
    expect(setup({ slack: 0 }).store.slack()).toBe(1);
  });

  it('treats blur and stt as strictly true, not truthy', () => {
    expect(setup({ blur: 'yes', stt: 1 }).store.blur()).toBe(false);
    expect(setup({ blur: 'yes', stt: 1 }).store.sttEnabled()).toBe(false);
  });

  it('coerces a missing or unparseable durationMin to 0', () => {
    expect(setup({ durationMin: 'nope' }).store.durationMin()).toBe(0);
    expect(setup({}).store.durationMin()).toBe(0);
  });
});

describe('SettingsStore persistence', () => {
  it('writes the legacy JSON shape, using the `stt` key', () => {
    const { store, write } = setup(null);
    store.setDeckId('travel');
    store.setRate(1.6);
    store.setSttEnabled(true);
    TestBed.tick();

    const [key, payload] = write.mock.lastCall as [string, Record<string, unknown>];
    expect(key).toBe(SETTINGS_KEY);
    expect(payload).toEqual({
      deckId: 'travel', rate: 1.6, slack: 1, voiceName: '',
      durationMin: 0, blur: false, stt: true,
    });
  });

  it('exposes the storage key the vanilla app used', () => {
    expect(SETTINGS_KEY).toBe('shadowing.settings');
  });
});
```

- [ ] **Step 3: Run it to confirm it fails**

```bash
npm test -- --include src/app/state/settings-store.spec.ts --watch=false
```

Expected: FAIL — cannot resolve `./settings-store`.

- [ ] **Step 4: Implement `settings-store.ts`**

`src/app/state/settings-store.ts`:

```ts
import { effect, inject, Injectable, signal } from '@angular/core';
import { ALL_DECK_ID } from '../core/deck';
import { SafeStorage } from '../platform/storage';

export const SETTINGS_KEY = 'shadowing.settings';

/** The on-disk shape. `stt` (not `sttEnabled`) is what existing users have. */
interface StoredSettings {
  deckId?: unknown;
  rate?: unknown;
  slack?: unknown;
  voiceName?: unknown;
  durationMin?: unknown;
  blur?: unknown;
  stt?: unknown;
}

/**
 * Owns every value that survives a reload. Other stores read from here rather
 * than keeping their own copy, so no setting is writable from two places.
 */
@Injectable({ providedIn: 'root' })
export class SettingsStore {
  private readonly storage = inject(SafeStorage);

  private readonly saved = this.storage.read<StoredSettings>(SETTINGS_KEY) ?? {};

  readonly deckId = signal<string>(
    typeof this.saved.deckId === 'string' && this.saved.deckId
      ? this.saved.deckId
      : ALL_DECK_ID,
  );
  // `Number(x) || fallback` is the vanilla coercion: it also turns 0 into 1.
  readonly rate = signal(Number(this.saved.rate) || 1);
  readonly slack = signal(Number(this.saved.slack) || 1);
  readonly voiceName = signal(
    typeof this.saved.voiceName === 'string' ? this.saved.voiceName : '',
  );
  readonly durationMin = signal(Number(this.saved.durationMin) || 0);
  readonly blur = signal(this.saved.blur === true);
  readonly sttEnabled = signal(this.saved.stt === true);

  constructor() {
    // One effect replaces the eight scattered saveSettings() calls.
    effect(() => {
      this.storage.write(SETTINGS_KEY, {
        deckId: this.deckId(),
        rate: this.rate(),
        slack: this.slack(),
        voiceName: this.voiceName(),
        durationMin: this.durationMin(),
        blur: this.blur(),
        stt: this.sttEnabled(),
      });
    });
  }

  setDeckId(id: string): void { this.deckId.set(id); }
  setRate(v: number): void { this.rate.set(v); }
  setSlack(v: number): void { this.slack.set(v); }
  setVoiceName(name: string): void { this.voiceName.set(name); }
  setDurationMin(min: number): void { this.durationMin.set(min); }
  setBlur(on: boolean): void { this.blur.set(on); }
  setSttEnabled(on: boolean): void { this.sttEnabled.set(on); }
}
```

- [ ] **Step 5: Run it to confirm it passes**

```bash
npm test -- --include src/app/state/settings-store.spec.ts --watch=false
```

Expected: PASS, 7 tests.

- [ ] **Step 6: Write the failing tests for `PracticeStore`**

`src/app/state/practice-store.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { type Corpus } from '../core/deck';
import { CORPUS_DATA } from './corpus-token';
import { PracticeStore } from './practice-store';
import { SettingsStore } from './settings-store';
import { SafeStorage } from '../platform/storage';

const DATA: Corpus = {
  generatedAt: '2026-08-06T00:00:00Z',
  decks: [
    { id: 'a', name: 'A', lines: ['a1', 'a2', 'a3'] },
    { id: 'b', name: 'B', lines: ['b1'] },
  ],
};

function setup() {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: SafeStorage, useValue: { read: () => null, write: () => {} } },
      { provide: CORPUS_DATA, useValue: DATA },
    ],
  });
  return {
    store: TestBed.inject(PracticeStore),
    settings: TestBed.inject(SettingsStore),
  };
}

describe('PracticeStore lines', () => {
  it('defaults to every line in deck order', () => {
    expect(setup().store.lines()).toEqual(['a1', 'a2', 'a3', 'b1']);
  });

  it('narrows to a deck and drives the settings store', () => {
    const { store, settings } = setup();
    store.selectDeck('b');
    expect(store.lines()).toEqual(['b1']);
    expect(settings.deckId()).toBe('b');
  });

  it('exposes deckOptions with All first', () => {
    expect(setup().store.deckOptions()[0]).toEqual({ id: 'all', name: 'All', count: 4 });
  });

  it('reports whether there is anything to practise', () => {
    const { store } = setup();
    expect(store.hasLines()).toBe(true);
    store.selectDeck('missing');
    expect(store.hasLines()).toBe(false);
  });
});

describe('PracticeStore navigation', () => {
  it('advances with wraparound', () => {
    const { store } = setup();
    store.selectDeck('a');
    store.advance();
    expect(store.index()).toBe(1);
    store.advance();
    store.advance();
    expect(store.index()).toBe(0);
  });

  it('steps back but never below zero', () => {
    const { store } = setup();
    store.goTo(1);
    store.back();
    expect(store.index()).toBe(0);
    store.back();
    expect(store.index()).toBe(0);
  });

  it('marks lines spoken', () => {
    const { store } = setup();
    store.markSpoken(0);
    store.markSpoken(2);
    expect(store.spoken().has(0)).toBe(true);
    expect(store.spoken().has(1)).toBe(false);
    expect(store.spoken().has(2)).toBe(true);
  });
});

describe('PracticeStore reset semantics', () => {
  it('selecting a deck resets index and spoken, matching the old full re-render', () => {
    const { store } = setup();
    store.goTo(2);
    store.markSpoken(0);
    store.selectDeck('a');
    expect(store.index()).toBe(0);
    expect(store.spoken().size).toBe(0);
  });

  it('shuffling reorders, resets index and spoken, and keeps every line', () => {
    const { store } = setup();
    store.goTo(3);
    store.markSpoken(0);
    store.shuffleLines(() => 0);

    expect(store.index()).toBe(0);
    expect(store.spoken().size).toBe(0);
    expect([...store.lines()].sort()).toEqual(['a1', 'a2', 'a3', 'b1']);
    expect(store.lines()).not.toEqual(['a1', 'a2', 'a3', 'b1']);
  });

  it('changing deck clears a previous shuffle', () => {
    const { store } = setup();
    store.shuffleLines(() => 0);
    store.selectDeck('a');
    expect(store.lines()).toEqual(['a1', 'a2', 'a3']);
  });
});
```

- [ ] **Step 7: Run it to confirm it fails**

```bash
npm test -- --include src/app/state/practice-store.spec.ts --watch=false
```

Expected: FAIL — cannot resolve `./corpus-token` or `./practice-store` (both arrive in the next two steps).

- [ ] **Step 8: Implement the corpus token**

Injecting the corpus rather than importing it directly lets stores be tested against a two-deck fixture instead of 2242 real lines.

`src/app/state/corpus-token.ts`:

```ts
import { InjectionToken } from '@angular/core';
import { type Corpus } from '../core/deck';
import { CORPUS } from '../data/corpus';

/** The corpus, injectable so stores can be tested against a small fixture. */
export const CORPUS_DATA = new InjectionToken<Corpus>('CORPUS_DATA', {
  providedIn: 'root',
  factory: () => CORPUS,
});
```

- [ ] **Step 9: Implement `practice-store.ts`**

`src/app/state/practice-store.ts`:

```ts
import { computed, inject, Injectable, signal } from '@angular/core';
import { deckOptions, linesFor } from '../core/deck';
import { type Rng, shuffle } from '../core/shuffle';
import { nextIndex } from '../core/timing';
import { CORPUS_DATA } from './corpus-token';
import { SettingsStore } from './settings-store';

/**
 * Transient practice state. The selected deck itself lives in SettingsStore
 * because it persists; `lines` is derived from it plus any active shuffle.
 */
@Injectable({ providedIn: 'root' })
export class PracticeStore {
  private readonly corpus = inject(CORPUS_DATA);
  private readonly settings = inject(SettingsStore);

  /** A shuffled snapshot, or null for the corpus's natural order. */
  private readonly order = signal<readonly string[] | null>(null);

  readonly index = signal(0);
  readonly playing = signal(false);
  readonly spoken = signal<ReadonlySet<number>>(new Set<number>());

  readonly deckOptions = computed(() => deckOptions(this.corpus));

  readonly lines = computed<readonly string[]>(
    () => this.order() ?? linesFor(this.corpus, this.settings.deckId()),
  );

  readonly hasLines = computed(() => this.lines().length > 0);

  /** Resets position and progress, mirroring the old full renderLines(). */
  selectDeck(id: string): void {
    this.settings.setDeckId(id);
    this.order.set(null);
    this.resetProgress();
  }

  shuffleLines(rng?: Rng): void {
    this.order.set(shuffle(this.lines(), rng));
    this.resetProgress();
  }

  goTo(i: number): void {
    this.index.set(i);
  }

  advance(): void {
    this.index.set(nextIndex(this.index(), this.lines().length));
  }

  back(): void {
    this.index.set(Math.max(0, this.index() - 1));
  }

  markSpoken(i: number): void {
    const next = new Set(this.spoken());
    next.add(i);
    this.spoken.set(next);
  }

  setPlaying(on: boolean): void {
    this.playing.set(on);
  }

  private resetProgress(): void {
    this.index.set(0);
    this.spoken.set(new Set<number>());
  }
}
```

- [ ] **Step 10: Run it to confirm it passes**

```bash
npm test -- --include src/app/state/practice-store.spec.ts --watch=false
```

Expected: PASS, 10 tests.

- [ ] **Step 11: Write the failing tests for `SessionTimerStore`**

`src/app/state/session-timer-store.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { Clock } from '../platform/clock';
import { SafeStorage } from '../platform/storage';
import { SessionTimerStore } from './session-timer-store';
import { SettingsStore } from './settings-store';

function setup() {
  let now = 1_000_000;
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: SafeStorage, useValue: { read: () => null, write: () => {} } },
      { provide: Clock, useValue: { now: () => now, ticks: () => now, wait: () => ({ done: Promise.resolve(), resolveNow: () => {} }) } },
    ],
  });
  return {
    timer: TestBed.inject(SessionTimerStore),
    settings: TestBed.inject(SettingsStore),
    advance: (ms: number) => { now += ms; },
  };
}

describe('SessionTimerStore in count-up mode (no limit)', () => {
  it('starts at 00:00 and counts elapsed time up', () => {
    const { timer, advance } = setup();
    expect(timer.clockText()).toBe('00:00');

    timer.resume();
    advance(65_000);
    timer.tick();
    expect(timer.clockText()).toBe('01:05');
  });

  it('never expires', () => {
    const { timer, advance } = setup();
    timer.resume();
    advance(60 * 60_000);
    expect(timer.expired()).toBe(false);
  });
});

describe('SessionTimerStore in countdown mode', () => {
  it('counts a 5 minute session down', () => {
    const { timer, settings, advance } = setup();
    settings.setDurationMin(5);
    timer.reset(5);
    expect(timer.clockText()).toBe('05:00');

    timer.resume();
    advance(60_000);
    timer.tick();
    expect(timer.clockText()).toBe('04:00');
  });

  it('expires once the remaining time is exhausted', () => {
    const { timer, settings, advance } = setup();
    settings.setDurationMin(1);
    timer.reset(1);
    timer.resume();

    advance(59_000);
    expect(timer.expired()).toBe(false);
    advance(1_000);
    expect(timer.expired()).toBe(true);
  });

  it('accrue banks elapsed time so the clock survives a pause', () => {
    const { timer, settings, advance } = setup();
    settings.setDurationMin(5);
    timer.reset(5);

    timer.resume();
    advance(30_000);
    timer.accrue(true);
    advance(120_000); // paused: this must not count
    timer.tick();
    expect(timer.clockText()).toBe('04:30');
  });

  it('accrue is a no-op when not playing', () => {
    const { timer, settings, advance } = setup();
    settings.setDurationMin(5);
    timer.reset(5);
    timer.resume();
    advance(30_000);
    timer.accrue(false);
    timer.tick();
    expect(timer.clockText()).toBe('05:00');
  });

  it('finish returns the spoken count then resets both', () => {
    const { timer, settings } = setup();
    settings.setDurationMin(5);
    timer.reset(5);
    timer.countSpoken();
    timer.countSpoken();

    expect(timer.finish()).toBe(2);
    expect(timer.spokenCount()).toBe(0);
    expect(timer.clockText()).toBe('05:00');
  });
});
```

- [ ] **Step 12: Run it to confirm it fails**

```bash
npm test -- --include src/app/state/session-timer-store.spec.ts --watch=false
```

Expected: FAIL — cannot resolve `./session-timer-store`.

- [ ] **Step 13: Implement `session-timer-store.ts`**

`src/app/state/session-timer-store.ts`:

```ts
import { computed, inject, Injectable, signal } from '@angular/core';
import { formatClock } from '../core/timing';
import { Clock } from '../platform/clock';
import { SettingsStore } from './settings-store';

/**
 * Session accounting. Two modes, both driven by the same two fields:
 *  - durationMin > 0: `remainingMs` counts down from the goal.
 *  - durationMin = 0: `remainingMs` accumulates upward, no limit.
 *
 * `resumedAt` is the un-banked slice; `accrue()` folds it into `remainingMs`
 * whenever playback pauses, so a paused clock does not drift.
 */
@Injectable({ providedIn: 'root' })
export class SessionTimerStore {
  private readonly clock = inject(Clock);
  private readonly settings = inject(SettingsStore);

  private resumedAt = 0;
  private running = false;
  /** Bumped by the 250 ms UI tick so `clockText` recomputes. */
  private readonly ticker = signal(0);

  readonly remainingMs = signal(0);
  readonly spokenCount = signal(0);

  readonly clockText = computed(() => {
    this.ticker();
    const elapsed = this.elapsed();
    const ms = this.settings.durationMin() > 0
      ? this.remainingMs() - elapsed
      : this.remainingMs() + elapsed;
    return formatClock(ms / 1000);
  });

  /** Call every 250 ms from the UI so the clock text advances. */
  tick(): void {
    this.ticker.update((n) => n + 1);
  }

  resume(): void {
    this.running = true;
    this.resumedAt = this.clock.now();
  }

  /** Banks the un-counted slice. Pass the current playing flag. */
  accrue(playing: boolean): void {
    if (!playing || !this.running) { return; }
    const used = this.clock.now() - this.resumedAt;
    this.remainingMs.update((ms) =>
      this.settings.durationMin() > 0 ? ms - used : ms + used,
    );
    this.resumedAt = this.clock.now();
    this.running = false;
  }

  expired(): boolean {
    return this.settings.durationMin() > 0
      && this.remainingMs() - this.elapsed() <= 0;
  }

  /** Sets a fresh goal (or 0 for unlimited) and clears the tally. */
  reset(minutes: number): void {
    this.running = false;
    this.resumedAt = 0;
    this.remainingMs.set(minutes * 60_000);
    this.spokenCount.set(0);
    this.tick();
  }

  countSpoken(): void {
    this.spokenCount.update((n) => n + 1);
  }

  /** Returns the tally for the summary banner, then resets the session. */
  finish(): number {
    const spoken = this.spokenCount();
    this.reset(this.settings.durationMin());
    return spoken;
  }

  private elapsed(): number {
    return this.running ? this.clock.now() - this.resumedAt : 0;
  }
}
```

- [ ] **Step 14: Run it to confirm it passes**

```bash
npm test -- --include src/app/state/session-timer-store.spec.ts --watch=false
```

Expected: PASS, 7 tests.

- [ ] **Step 15: Write the failing tests for `BannerStore`**

The source guard is subtle and currently untested: `clear` must not dismiss a banner raised by a different concern.

`src/app/state/banner-store.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { BannerStore } from './banner-store';

describe('BannerStore', () => {
  let banner: BannerStore;

  beforeEach(() => {
    TestBed.resetTestingModule();
    banner = TestBed.inject(BannerStore);
  });

  it('starts hidden', () => {
    expect(banner.visible()).toBe(false);
    expect(banner.html()).toBeNull();
  });

  it('shows the given html', () => {
    banner.show('<b>oops</b>', 'no-voice');
    expect(banner.visible()).toBe(true);
    expect(banner.html()).toBe('<b>oops</b>');
  });

  it('a later source takes the banner over', () => {
    banner.show('first', 'no-voice');
    banner.show('second', 'dead-voice');
    expect(banner.html()).toBe('second');
  });

  it('clear dismisses when the source owns the banner', () => {
    banner.show('mine', 'no-voice');
    banner.clear('no-voice');
    expect(banner.visible()).toBe(false);
  });

  it('clear is a no-op when another source owns the banner', () => {
    banner.show('theirs', 'dead-voice');
    banner.clear('no-voice');
    expect(banner.visible()).toBe(true);
    expect(banner.html()).toBe('theirs');
  });

  it('clearAll dismisses regardless of owner', () => {
    banner.show('theirs', 'dead-voice');
    banner.clearAll();
    expect(banner.visible()).toBe(false);
  });

  it('clear on an empty banner is harmless', () => {
    expect(() => banner.clear('summary')).not.toThrow();
    expect(banner.visible()).toBe(false);
  });
});
```

- [ ] **Step 16: Run it to confirm it fails**

```bash
npm test -- --include src/app/state/banner-store.spec.ts --watch=false
```

Expected: FAIL — cannot resolve `./banner-store`.

- [ ] **Step 17: Implement `banner-store.ts`**

`src/app/state/banner-store.ts`:

```ts
import { computed, Injectable, signal } from '@angular/core';

export type BannerSource =
  | 'no-voice'
  | 'unsupported'
  | 'dead-voice'
  | 'stt-denied'
  | 'summary';

/**
 * One banner slot, shared by several concerns. Each raises it with its own
 * source tag and may only dismiss its own message, so (for example) voices
 * arriving cannot silently clear a session-summary banner.
 */
@Injectable({ providedIn: 'root' })
export class BannerStore {
  private readonly source = signal<BannerSource | null>(null);

  readonly html = signal<string | null>(null);
  readonly visible = computed(() => this.html() !== null);

  show(html: string, source: BannerSource): void {
    this.source.set(source);
    this.html.set(html);
  }

  /** No-op unless `source` currently owns the banner. */
  clear(source: BannerSource): void {
    if (this.source() !== source) { return; }
    this.clearAll();
  }

  clearAll(): void {
    this.source.set(null);
    this.html.set(null);
  }
}
```

- [ ] **Step 18: Run it to confirm it passes**

```bash
npm test -- --include src/app/state/banner-store.spec.ts --watch=false
```

Expected: PASS, 7 tests.

- [ ] **Step 19: Write the failing tests for `VoiceStore`**

`src/app/state/voice-store.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { Speaker } from '../platform/speaker';
import { SafeStorage } from '../platform/storage';
import { SettingsStore } from './settings-store';
import { VoiceStore } from './voice-store';

const v = (name: string, lang: string) => ({ name, lang } as SpeechSynthesisVoice);

function setup(voices: SpeechSynthesisVoice[], storedVoiceName = '') {
  const listeners: Array<() => void> = [];
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: SafeStorage, useValue: { read: () => ({ voiceName: storedVoiceName }), write: () => {} } },
      {
        provide: Speaker,
        useValue: {
          voices: () => voices,
          onVoicesChanged: (fn: () => void) => void listeners.push(fn),
        },
      },
    ],
  });
  return {
    store: TestBed.inject(VoiceStore),
    settings: TestBed.inject(SettingsStore),
    fireVoicesChanged: () => listeners.forEach((fn) => fn()),
    setVoices: (next: SpeechSynthesisVoice[]) => { voices = next; },
  };
}

describe('VoiceStore', () => {
  it('is empty until refreshed', () => {
    expect(setup([v('David', 'en-US')]).store.voices()).toEqual([]);
  });

  it('loads voices on refresh', () => {
    const { store } = setup([v('David', 'en-US')]);
    store.refresh();
    expect(store.voices().length).toBe(1);
  });

  it('ignores an empty voice list, since Chrome reports [] before it is ready', () => {
    const { store, setVoices } = setup([]);
    store.refresh();
    expect(store.voices()).toEqual([]);

    setVoices([v('David', 'en-US')]);
    store.refresh();
    expect(store.voices().length).toBe(1);
  });

  it('filters the picker list to English voices only', () => {
    const { store } = setup([v('Maria', 'pt-BR'), v('David', 'en-US'), v('Sonia', 'en-GB')]);
    store.refresh();
    expect(store.englishVoices().map((x) => x.name)).toEqual(['David', 'Sonia']);
  });

  it('selects the remembered voice when it is present', () => {
    const { store } = setup([v('Aria Natural', 'en-US'), v('David', 'en-US')], 'David');
    store.refresh();
    expect(store.selected()?.name).toBe('David');
  });

  it('prefers a Natural en-US voice with nothing remembered', () => {
    const { store } = setup([v('David', 'en-US'), v('Aria Natural', 'en-US')]);
    store.refresh();
    expect(store.selected()?.name).toBe('Aria Natural');
  });

  it('reports whether any English voice exists', () => {
    const withEn = setup([v('David', 'en-US')]);
    withEn.store.refresh();
    expect(withEn.store.hasEnglish()).toBe(true);

    const withoutEn = setup([v('Maria', 'pt-BR')]);
    withoutEn.store.refresh();
    expect(withoutEn.store.hasEnglish()).toBe(false);
  });

  it('refreshes when the platform fires voiceschanged', () => {
    const { store, setVoices, fireVoicesChanged } = setup([]);
    setVoices([v('David', 'en-US')]);
    fireVoicesChanged();
    expect(store.voices().length).toBe(1);
  });
});
```

- [ ] **Step 20: Run it to confirm it fails**

```bash
npm test -- --include src/app/state/voice-store.spec.ts --watch=false
```

Expected: FAIL — cannot resolve `./voice-store`.

- [ ] **Step 21: Implement `voice-store.ts`**

`src/app/state/voice-store.ts`:

```ts
import { computed, inject, Injectable, signal } from '@angular/core';
import { hasEnglishVoice, isEnglish, pickVoice } from '../core/voice';
import { Speaker } from '../platform/speaker';
import { SettingsStore } from './settings-store';

/**
 * The platform's voice list. Chrome reports an empty array until the list is
 * ready and then fires `voiceschanged`, so an empty refresh is ignored rather
 * than treated as "no voices installed".
 */
@Injectable({ providedIn: 'root' })
export class VoiceStore {
  private readonly speaker = inject(Speaker);
  private readonly settings = inject(SettingsStore);

  readonly voices = signal<readonly SpeechSynthesisVoice[]>([]);

  /** What the picker shows: English voices only. */
  readonly englishVoices = computed(() => this.voices().filter(isEnglish));

  readonly selected = computed(() =>
    pickVoice(this.voices(), this.settings.voiceName()),
  );

  readonly hasEnglish = computed(() => hasEnglishVoice(this.voices()));

  constructor() {
    this.speaker.onVoicesChanged(() => this.refresh());
  }

  refresh(): void {
    const next = this.speaker.voices();
    if (!next.length) { return; }
    this.voices.set(next);
  }
}
```

- [ ] **Step 22: Run it to confirm it passes**

```bash
npm test -- --include src/app/state/voice-store.spec.ts --watch=false
```

Expected: PASS, 8 tests.

- [ ] **Step 23: Run the whole suite**

```bash
npm test -- --watch=false && npm run test:e2e
```

Expected: 124 Vitest tests pass; 15 Playwright specs pass against the vanilla app.

- [ ] **Step 24: Commit**

```bash
git add -A
git commit -m "refactor: replace the mutable state bag with signal stores

The 29-field state object from js/app.js splits into SettingsStore (everything
that persists), PracticeStore, SessionTimerStore, BannerStore and VoiceStore.
Each value has exactly one owner; derived values are computed.

Persistence collapses into one effect() and keeps the legacy JSON shape,
including the `stt` key existing users have on disk. All banner copy moves to
state/messages.ts, verbatim, so the eventual language cleanup is one file.

New coverage: the banner source guard, the countdown/count-up split, accrue()
not drifting across a pause, and VoiceStore ignoring Chrome's premature empty
voice list.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: `playback/` — the loop, finally testable

Ports `runLoop`, `speak`, `bump`, `wait` and the transport verbs from `js/app.js:435-579`. This is the largest single coverage gain in the plan: the eight behaviors listed in the spec's §3 are all currently unreachable from a test.

**Files:**
- Create: `src/app/playback/playback-service.ts`
- Create: `src/app/playback/playback-service.spec.ts`
- Reference: `js/app.js:189-213` (speak), `js/app.js:240-286` (bump/wait), `js/app.js:435-496` (transport), `js/app.js:498-579` (runLoop), `js/app.js:595-608` (session)

**Interfaces:**
- Consumes: `stripTags` (`core/text.ts`), `pauseMs`, `nextIndex` (`core/timing.ts`), `Speaker`, `Clock` (`platform/`), `PracticeStore`, `SettingsStore`, `SessionTimerStore`, `BannerStore`, `VoiceStore`, `MESSAGES` (`state/`).
- Produces: `PlaybackService` with `progress: Signal<number>`, `inGap: Signal<boolean>`, `play()`, `pause()`, `toggle()`, `next()`, `previous()`, `shuffle(rng?)`, `playLine(i)`, `stop()`, and `setValidationHook(fn: ValidationHook | null)`; `ValidationHook = (lineIndex: number, plainText: string) => Promise<void> | null`.

- [ ] **Step 1: Write the failing tests**

`src/app/playback/playback-service.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type Corpus } from '../core/deck';
import { Clock } from '../platform/clock';
import { Speaker } from '../platform/speaker';
import { SafeStorage } from '../platform/storage';
import { BannerStore } from '../state/banner-store';
import { CORPUS_DATA } from '../state/corpus-token';
import { MESSAGES } from '../state/messages';
import { PracticeStore } from '../state/practice-store';
import { SessionTimerStore } from '../state/session-timer-store';
import { SettingsStore } from '../state/settings-store';
import { VoiceStore } from '../state/voice-store';
import { PlaybackService } from './playback-service';

const DATA: Corpus = {
  generatedAt: '2026-08-06T00:00:00Z',
  decks: [{
    id: 'a',
    name: 'A',
    lines: [
      'first <b>line</b> is long enough to measure',
      'second line is long enough to measure',
      'third line is long enough to measure',
    ],
  }],
};

/** Speaker fake whose utterances take a controllable amount of fake time. */
function fakeSpeaker(speakMs = 1000) {
  const spoken: string[] = [];
  return {
    spoken,
    setSpeakMs: (ms: number) => { speakMs = ms; },
    impl: {
      supported: true,
      spoken,
      voices: () => [{ name: 'David', lang: 'en-US' }] as SpeechSynthesisVoice[],
      onVoicesChanged: () => {},
      cancel: vi.fn(),
      keepAlive: vi.fn(),
      speak: vi.fn((text: string) => {
        spoken.push(text);
        return new Promise<void>((resolve) => setTimeout(resolve, speakMs));
      }),
    },
  };
}

function setup(speakMs = 1000) {
  const speaker = fakeSpeaker(speakMs);
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: SafeStorage, useValue: { read: () => null, write: () => {} } },
      { provide: CORPUS_DATA, useValue: DATA },
      { provide: Speaker, useValue: speaker.impl },
    ],
  });
  return {
    speaker,
    playback: TestBed.inject(PlaybackService),
    practice: TestBed.inject(PracticeStore),
    settings: TestBed.inject(SettingsStore),
    timer: TestBed.inject(SessionTimerStore),
    banner: TestBed.inject(BannerStore),
    voices: TestBed.inject(VoiceStore),
    clock: TestBed.inject(Clock),
  };
}

describe('PlaybackService transport', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('speaks the current line with markup stripped', async () => {
    const { playback, speaker } = setup();
    playback.play();
    await vi.advanceTimersByTimeAsync(0);
    expect(speaker.spoken[0]).toBe('first line is long enough to measure');
  });

  it('advances after speaking plus the gap', async () => {
    const { playback, practice } = setup(1000);
    playback.play();
    await vi.advanceTimersByTimeAsync(1000); // speech
    expect(practice.index()).toBe(0);
    await vi.advanceTimersByTimeAsync(1000); // gap at slack 1
    expect(practice.index()).toBe(1);
  });

  it('marks the line just passed as spoken before advancing', async () => {
    const { playback, practice } = setup(1000);
    playback.play();
    await vi.advanceTimersByTimeAsync(2000);
    expect(practice.spoken().has(0)).toBe(true);
    expect(practice.index()).toBe(1);
  });

  it('wraps at the end of the deck', async () => {
    const { playback, practice } = setup(1000);
    practice.goTo(2);
    playback.play();
    await vi.advanceTimersByTimeAsync(2000);
    expect(practice.index()).toBe(0);
  });

  it('pause stops the loop and cancels speech', async () => {
    const { playback, practice, speaker } = setup(1000);
    playback.play();
    await vi.advanceTimersByTimeAsync(500);
    playback.pause();

    expect(practice.playing()).toBe(false);
    expect(speaker.impl.cancel).toHaveBeenCalled();

    const before = speaker.spoken.length;
    await vi.advanceTimersByTimeAsync(10_000);
    expect(speaker.spoken.length).toBe(before);
  });

  it('toggle flips between playing and paused', async () => {
    const { playback, practice } = setup();
    playback.toggle();
    expect(practice.playing()).toBe(true);
    playback.toggle();
    expect(practice.playing()).toBe(false);
  });

  it('does nothing when there are no lines', () => {
    const { playback, practice } = setup();
    practice.selectDeck('missing');
    playback.play();
    expect(practice.playing()).toBe(false);
  });

  it('next advances immediately and restarts the loop while playing', async () => {
    const { playback, practice, speaker } = setup(1000);
    playback.play();
    await vi.advanceTimersByTimeAsync(100);
    playback.next();

    expect(practice.index()).toBe(1);
    expect(practice.spoken().has(0)).toBe(true);
    await vi.advanceTimersByTimeAsync(0);
    expect(speaker.spoken.at(-1)).toBe('second line is long enough to measure');
  });

  it('next while paused moves without speaking', async () => {
    const { playback, practice, speaker } = setup();
    playback.next();
    await vi.advanceTimersByTimeAsync(0);
    expect(practice.index()).toBe(1);
    expect(speaker.spoken).toEqual([]);
  });

  it('shuffle reorders, resets to the top and keeps playing', async () => {
    const { playback, practice } = setup(1000);
    playback.play();
    await vi.advanceTimersByTimeAsync(2000);
    expect(practice.index()).toBe(1);

    playback.shuffle(() => 0);
    expect(practice.index()).toBe(0);
    expect(practice.playing()).toBe(true);
    expect([...practice.lines()].sort()).toEqual([...DATA.decks[0].lines].sort());
  });

  it('playLine speaks one line without starting the loop', async () => {
    const { playback, practice, speaker } = setup(1000);
    playback.playLine(2);
    expect(practice.index()).toBe(2);
    expect(practice.playing()).toBe(false);
    await vi.advanceTimersByTimeAsync(0);
    expect(speaker.spoken).toEqual(['third line is long enough to measure']);
  });
});

describe('PlaybackService cancellation', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('a deck switch mid-gap does not advance the new deck', async () => {
    const { playback, practice } = setup(1000);
    playback.play();
    await vi.advanceTimersByTimeAsync(1200); // into the gap
    playback.stop();
    practice.selectDeck('a');

    await vi.advanceTimersByTimeAsync(10_000);
    expect(practice.index()).toBe(0);
  });

  it('restarting mid-gap does not leave two loops running', async () => {
    const { playback, speaker } = setup(1000);
    playback.play();
    await vi.advanceTimersByTimeAsync(1200);
    playback.play();
    await vi.advanceTimersByTimeAsync(4000);

    // Two concurrent loops would roughly double this count.
    expect(speaker.spoken.length).toBeLessThanOrEqual(4);
  });
});

describe('PlaybackService gap timing', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('scales the gap by the slack setting', async () => {
    const { playback, practice, settings } = setup(1000);
    settings.setSlack(2);
    playback.play();
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(1500);
    expect(practice.index()).toBe(0);
    await vi.advanceTimersByTimeAsync(500);
    expect(practice.index()).toBe(1);
  });

  it('never waits less than the 400 ms floor', async () => {
    const { playback, practice, settings } = setup(200);
    settings.setSlack(0);
    playback.play();
    await vi.advanceTimersByTimeAsync(200);
    await vi.advanceTimersByTimeAsync(399);
    expect(practice.index()).toBe(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(practice.index()).toBe(1);
  });

  it('reports gap progress from 0 to 1', async () => {
    const { playback } = setup(1000);
    playback.play();
    await vi.advanceTimersByTimeAsync(1000);
    expect(playback.progress()).toBe(0);
    await vi.advanceTimersByTimeAsync(500);
    expect(playback.progress()).toBeGreaterThan(0);
    expect(playback.progress()).toBeLessThanOrEqual(1);
  });

  it('flags inGap for the whole gap and clears it afterwards', async () => {
    const { playback } = setup(1000);
    expect(playback.inGap()).toBe(false);

    playback.play();
    await vi.advanceTimersByTimeAsync(1000); // speech done, gap starts
    expect(playback.inGap()).toBe(true);
    // Present from the first frame, before any progress has accrued.
    expect(playback.progress()).toBe(0);

    await vi.advanceTimersByTimeAsync(1000); // gap done
    expect(playback.inGap()).toBe(false);
  });

  it('clears inGap when playback is stopped mid-gap', async () => {
    const { playback } = setup(1000);
    playback.play();
    await vi.advanceTimersByTimeAsync(1200);
    expect(playback.inGap()).toBe(true);
    playback.pause();
    expect(playback.inGap()).toBe(false);
  });
});

describe('PlaybackService dead-voice detection', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('stops and warns after three silent utterances in a row', async () => {
    const { playback, practice, banner } = setup(0);
    playback.play();
    await vi.advanceTimersByTimeAsync(5000);

    expect(practice.playing()).toBe(false);
    expect(banner.html()).toBe(MESSAGES.deadVoice);
  });

  it('does not count a short utterance of short text as a failure', async () => {
    const short: Corpus = {
      generatedAt: '2026-08-06T00:00:00Z',
      decks: [{ id: 'a', name: 'A', lines: ['hi', 'yo', 'ok'] }],
    };
    const speaker = fakeSpeaker(0);
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: SafeStorage, useValue: { read: () => null, write: () => {} } },
        { provide: CORPUS_DATA, useValue: short },
        { provide: Speaker, useValue: speaker.impl },
      ],
    });
    const playback = TestBed.inject(PlaybackService);
    const banner = TestBed.inject(BannerStore);

    playback.play();
    await vi.advanceTimersByTimeAsync(5000);
    expect(banner.html()).not.toBe(MESSAGES.deadVoice);
  });

  it('resets the failure streak after a healthy utterance', async () => {
    const { playback, speaker, banner } = setup(0);
    playback.play();
    await vi.advanceTimersByTimeAsync(500);
    speaker.setSpeakMs(1000);
    await vi.advanceTimersByTimeAsync(4000);
    expect(banner.html()).not.toBe(MESSAGES.deadVoice);
  });

  it('counts only healthy utterances toward the session tally', async () => {
    const { playback, timer } = setup(1000);
    playback.play();
    await vi.advanceTimersByTimeAsync(4000);
    expect(timer.spokenCount()).toBeGreaterThan(0);
  });
});

describe('PlaybackService session expiry', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('finishes with a summary once a timed session runs out', async () => {
    const { playback, practice, settings, timer, banner } = setup(1000);
    settings.setDurationMin(1);
    timer.reset(1);

    playback.play();
    await vi.advanceTimersByTimeAsync(70_000);

    expect(practice.playing()).toBe(false);
    expect(banner.html()).toContain('Sess');
    expect(timer.spokenCount()).toBe(0);
  });

  it('does not finish an unlimited session', async () => {
    const { playback, practice, banner } = setup(1000);
    playback.play();
    await vi.advanceTimersByTimeAsync(120_000);
    expect(practice.playing()).toBe(true);
    expect(banner.visible()).toBe(false);
  });
});

describe('PlaybackService validation hook', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('ends the gap early when validation resolves first', async () => {
    const { playback, practice } = setup(1000);
    let release!: () => void;
    playback.setValidationHook(() => new Promise<void>((r) => { release = r; }));

    playback.play();
    await vi.advanceTimersByTimeAsync(1000);
    release();
    await vi.advanceTimersByTimeAsync(0);
    expect(practice.index()).toBe(1);
  });

  it('still ends the gap on time when validation never resolves', async () => {
    const { playback, practice } = setup(1000);
    playback.setValidationHook(() => new Promise<void>(() => {}));

    playback.play();
    await vi.advanceTimersByTimeAsync(2000);
    expect(practice.index()).toBe(1);
  });

  it('passes the line index and the stripped text to the hook', async () => {
    const { playback } = setup(1000);
    const calls: Array<[number, string]> = [];
    playback.setValidationHook((i, text) => { calls.push([i, text]); return null; });

    playback.play();
    await vi.advanceTimersByTimeAsync(1000);
    expect(calls[0]).toEqual([0, 'first line is long enough to measure']);
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

```bash
npm test -- --include src/app/playback/playback-service.spec.ts --watch=false
```

Expected: FAIL — cannot resolve `./playback-service`.

- [ ] **Step 3: Implement `playback-service.ts`**

`src/app/playback/playback-service.ts`:

```ts
import { inject, Injectable, signal } from '@angular/core';
import { type Rng } from '../core/shuffle';
import { stripTags } from '../core/text';
import { pauseMs } from '../core/timing';
import { Clock, type PendingWait } from '../platform/clock';
import { Speaker } from '../platform/speaker';
import { BannerStore } from '../state/banner-store';
import { MESSAGES } from '../state/messages';
import { PracticeStore } from '../state/practice-store';
import { SessionTimerStore } from '../state/session-timer-store';
import { SettingsStore } from '../state/settings-store';
import { VoiceStore } from '../state/voice-store';

/**
 * Called at the start of each gap when the speech validator is on. Returning a
 * promise makes the gap end as soon as it resolves; returning null just runs
 * the gap to its full length.
 */
export type ValidationHook = (
  lineIndex: number,
  plainText: string,
) => Promise<void> | null;

/** Shortest gap we ever give, even at slack 0. */
const MIN_GAP_MS = 400;
/** An utterance shorter than this, for text longer than DEAD_VOICE_MIN_CHARS, is silent. */
const DEAD_VOICE_MS = 150;
const DEAD_VOICE_MIN_CHARS = 15;
/** Consecutive silent utterances before we blame the voice. */
const DEAD_VOICE_STREAK = 3;

@Injectable({ providedIn: 'root' })
export class PlaybackService {
  private readonly speaker = inject(Speaker);
  private readonly clock = inject(Clock);
  private readonly practice = inject(PracticeStore);
  private readonly settings = inject(SettingsStore);
  private readonly timer = inject(SessionTimerStore);
  private readonly banner = inject(BannerStore);
  private readonly voices = inject(VoiceStore);

  /**
   * Monotonic run token. Every control bumps it; the loop compares it on each
   * await boundary and returns if it no longer owns the run. This is what makes
   * cancellation safe without tearing down mid-utterance state.
   */
  private generation = 0;
  private gap: PendingWait | null = null;
  private silentStreak = 0;
  private validate: ValidationHook | null = null;

  /** Gap completion, 0 to 1, for the progress ring. */
  readonly progress = signal(0);

  /**
   * True for the whole duration of a gap. The ring mounts and unmounts on this
   * rather than on `progress > 0`, so it is present at offset-full from the
   * first frame and visibly drains, as the vanilla ring did.
   */
  readonly inGap = signal(false);

  setValidationHook(fn: ValidationHook | null): void {
    this.validate = fn;
  }

  play(): void {
    if (!this.practice.hasLines()) { return; }
    const gen = this.bump();
    this.timer.accrue(this.practice.playing());
    this.practice.setPlaying(true);
    this.timer.resume();
    this.banner.clearAll();
    void this.runLoop(gen).catch(() => this.stop());
  }

  pause(): void {
    this.stop();
  }

  toggle(): void {
    if (this.practice.playing()) {
      this.pause();
    } else {
      this.silentStreak = 0;
      this.play();
    }
  }

  stop(): void {
    this.bump();
    this.timer.accrue(this.practice.playing());
    this.practice.setPlaying(false);
    this.progress.set(0);
    this.inGap.set(false);
  }

  /** Advances one line, restarting playback if it was running. */
  next(): void {
    this.practice.markSpoken(this.practice.index());
    this.practice.advance();
    if (this.practice.playing()) { this.play(); } else { this.bump(); }
  }

  /** Steps back one line and (re)starts playback, as ArrowLeft does. */
  previous(): void {
    this.practice.back();
    this.silentStreak = 0;
    this.play();
  }

  shuffle(rng?: Rng): void {
    const wasPlaying = this.practice.playing();
    this.stop();
    this.practice.shuffleLines(rng);
    if (wasPlaying) { this.play(); }
  }

  /** Jumps to a line: speaks it alone when paused, resumes the loop when playing. */
  playLine(i: number): void {
    this.practice.goTo(i);
    if (this.practice.playing()) {
      this.play();
      return;
    }
    this.bump();
    void this.speakCurrent();
  }

  /**
   * Invalidates the current run: bumps the token, ends any gap immediately and
   * silences the synthesizer. Returns the new token for the caller to own.
   */
  private bump(): number {
    this.generation++;
    this.gap?.resolveNow();
    this.gap = null;
    this.speaker.cancel();
    return this.generation;
  }

  private speakCurrent(): Promise<void> {
    const text = stripTags(this.practice.lines()[this.practice.index()] ?? '');
    return this.speaker.speak(text, {
      rate: this.settings.rate(),
      voice: this.voices.selected(),
    });
  }

  private async runLoop(gen: number): Promise<void> {
    while (this.practice.playing() && gen === this.generation) {
      const index = this.practice.index();
      const text = stripTags(this.practice.lines()[index] ?? '');

      const startedAt = this.clock.ticks();
      await this.speaker.speak(text, {
        rate: this.settings.rate(),
        voice: this.voices.selected(),
      });
      if (!this.owns(gen)) { return; }

      const speechMs = this.clock.ticks() - startedAt;
      if (this.looksSilent(speechMs, text)) {
        if (++this.silentStreak >= DEAD_VOICE_STREAK) {
          this.stop();
          this.banner.show(MESSAGES.deadVoice, 'dead-voice');
          return;
        }
      } else {
        this.silentStreak = 0;
        this.timer.countSpoken();
      }

      if (this.finishIfExpired()) { return; }

      const gapMs = Math.max(MIN_GAP_MS, pauseMs(this.clock.ticks() - startedAt, this.settings.slack()));
      await this.runGap(gapMs, index, text);
      if (!this.owns(gen)) { return; }

      if (this.finishIfExpired()) { return; }

      this.practice.markSpoken(index);
      this.practice.advance();
    }
  }

  private async runGap(gapMs: number, index: number, text: string): Promise<void> {
    const startedAt = this.clock.ticks();
    this.progress.set(0);
    this.inGap.set(true);

    const validation = this.validate?.(index, text) ?? undefined;
    this.gap = this.clock.wait(gapMs, validation ?? undefined);

    // Sample progress alongside the wait; the ring reads this signal.
    const sampler = setInterval(() => {
      const p = (this.clock.ticks() - startedAt) / gapMs;
      this.progress.set(Math.min(1, Math.max(0, p)));
    }, 50);

    try {
      await this.gap.done;
    } finally {
      clearInterval(sampler);
      this.gap = null;
      this.inGap.set(false);
      this.progress.set(0);
    }
  }

  /**
   * A long sentence that returned almost instantly means the voice produced no
   * audio — typically an Edge Natural voice with no network.
   */
  private looksSilent(speechMs: number, text: string): boolean {
    return speechMs < DEAD_VOICE_MS && text.length > DEAD_VOICE_MIN_CHARS;
  }

  private finishIfExpired(): boolean {
    if (!this.timer.expired()) { return false; }
    const minutes = this.settings.durationMin();
    this.stop();
    const spoken = this.timer.finish();
    this.banner.show(MESSAGES.sessionSummary(minutes, spoken), 'summary');
    return true;
  }

  private owns(gen: number): boolean {
    return gen === this.generation && this.practice.playing();
  }
}
```

- [ ] **Step 4: Run it to confirm it passes**

```bash
npm test -- --include src/app/playback/playback-service.spec.ts --watch=false
```

Expected: PASS, 26 tests. If the dead-voice or expiry tests are off by one iteration, check that `finishIfExpired` runs at **both** checkpoints — after the speak and after the gap — as `js/app.js:526` and `js/app.js:573` do.

- [ ] **Step 5: Confirm every spec §3 semantic has a test**

Read `docs/superpowers/specs/2026-08-07-angular-migration-design.md` §3 and tick off all eight against `playback-service.spec.ts`:

1. `bump()` cancellation — "restarting mid-gap does not leave two loops running"
2. `speak()` settling once — covered in `speaker.spec.ts` (Task 4)
3. dead-voice at three failures — "stops and warns after three silent utterances"
4. `spokenCount` only on success — "counts only healthy utterances toward the session tally"
5. gap floor of 400 ms — "never waits less than the 400 ms floor"
6. STT racing the gap — "ends the gap early when validation resolves first"
7. `spoken` before advance — "marks the line just passed as spoken before advancing"
8. expiry checked twice — "finishes with a summary once a timed session runs out"

- [ ] **Step 6: Run the whole suite**

```bash
npm test -- --watch=false && npm run test:e2e && npx ng build
```

Expected: 150 Vitest tests pass; 15 Playwright specs pass; the build succeeds.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: extract the playback loop into a testable PlaybackService

Ports runLoop, speak, bump and the transport verbs out of js/app.js. The
generation-counter cancellation protocol is preserved exactly; with Speaker
and Clock injected, all eight of its documented semantics are now covered by
fast unit tests for the first time.

The imperative SVG ring is replaced by a progress signal, and the speech
validator attaches through a ValidationHook that races the gap timer.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Where this leaves the repo

After Task 6 the repo holds a fully tested, headless Angular application core — roughly 150 unit tests, up from 61 — with no UI. `index.html`, `css/`, `js/` and `data/data.js` are untouched and still what CI deploys, and the 15 Playwright specs still run against them.

Part 2 (`docs/superpowers/plans/2026-08-07-angular-migration-part2-ui-cutover.md`) builds the component tree against this core in five slices, each unlocking named Playwright specs, then deletes the vanilla app and switches CI to the Angular build.

## Self-review notes

- **Spec coverage:** §1 architecture → Tasks 2–6. §2 data flow → Tasks 5–6 (persistence effect, ticker signal, progress signal). §3 playback → Task 6 Step 5 maps all eight semantics to named tests. §4 error handling → the storage, microphone, speaker, banner and dead-voice tests; the keyboard, keepalive, `pagehide` and STT-error-code entries are UI-attached and land in Part 2. §5 testing tiers 1–2 → Tasks 2–6; tiers 3–4 → Part 2. §6 build/deploy → Task 1 partially (`src/index.html`, `styles.css`, `.gitignore`); the `webServer` and CI rewrite land in Part 2. §7 sequence steps 1–6 → Tasks 1–6.
- **Accepted deletions** are implemented in Task 3 Steps 5–6, with the out-of-repo generator follow-up recorded in `README.md`.
- **Known gap, deliberate:** `MESSAGES.speechUnsupported`, `MESSAGES.micDenied`, `MESSAGES.listening`, `MESSAGES.noSpeechDetected`, `MESSAGES.micDeniedInline` and `MESSAGES.couldNotListen` are defined in Task 5 but not consumed until Part 2. They are placed here so all copy lives in one file from the start.
