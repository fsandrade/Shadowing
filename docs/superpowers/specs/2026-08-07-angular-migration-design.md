# Shadowing → Angular 22: migration design

**Date:** 2026-08-07
**Branch:** `feature/angular`
**Status:** approved, ready for implementation planning

## Goal

Convert the vanilla Shadowing app into a well-organized, testable Angular 22 application
with **no observable change in behavior**. The existing Playwright suite is the acceptance
gate: all 15 specs must pass with only the app URL changed.

"Testable" has a concrete meaning here. Today `js/app.js` reaches for `window` in roughly
fifteen places, so the playback loop, the session clock, microphone permission, settings
persistence and the dead-voice heuristic are all unreachable from a unit test. The migration
is judged successful when each of those is covered by a test that runs in milliseconds.

## Starting point

| File | Lines | Role |
| --- | --- | --- |
| `index.html` | 97 | All markup: header, durations, clock, sidebar, transport, sliders, banner, lines, snackbar, help modal |
| `css/style.css` | 270 | Global stylesheet, entirely position-dependent selectors |
| `js/core.js` | 149 | Pure helpers, already exported UMD-style |
| `js/stt.js` | 81 | `SpeechRecognition` wrapper |
| `js/app.js` | 843 | Monolith: one mutable 29-field `state` bag, direct DOM refs, speech synthesis, async playback loop, imperative SVG, session clock, localStorage, keyboard, modal, mic |
| `data/data.js` | 2391 | `window.SHADOWING` — 24 decks, 2242 lines with `<b>` chunk markup |

Tests: 61 `node --test` assertions across `core.test.js` (42), `stt.test.js` (10) and
`data.test.js` (9, one skipped in CI), plus 15 Playwright specs driven through a
`speechSynthesis` fake.

CI runs both suites, then copies the raw files to GitHub Pages. There is no build step.

## Decisions

| Decision | Choice |
| --- | --- |
| Fidelity | **Strict behavior parity.** Same UI, keys, timings and `localStorage` keys. Mixed-language banner copy (Portuguese) is carried over verbatim; normalizing it is a separate follow-up. |
| Unit test runner | **Vitest** via `@angular/build:unit-test` — the Angular 22 default. |
| List rendering | **Plain `@for`, all 2242 lines.** Preserves `toHaveCount(2242)` and `scrollIntoView` semantics. No CDK virtual scroll. |
| Repo layout | **Angular at repo root.** Vanilla files stay on disk untouched until the final step, then are deleted in one reviewable commit. |
| Corpus loading | **Statically imported TypeScript module.** `data/data.js` becomes `src/app/data/corpus.ts` exporting a typed `Corpus` const, present synchronously at startup. |
| Angular flags | Angular 22 defaults: standalone, zoneless, Vitest, CSS, 2025 file-naming (`app.ts`), no routing. |

### Rejected approaches

**Thin Angular shell over the existing `app.js`.** One `AppComponent` calling the current
IIFE. Two days of work and zero risk, but it delivers Angular's build system and nothing
else — not organized, not testable. The 843-line monolith survives intact.

**Full rewrite with routing and an RxJS state machine.** A route per topic, playback as a
stream. `runLoop`'s speak → wait → advance sequence with generation-based cancellation is
genuinely clearer as `async/await` than as a stream, and this abandons parity, which is the
only cheap correctness guarantee available.

## Constraint that shapes everything: the stylesheet

`css/style.css` uses global, position-dependent selectors throughout:

- `body { display: grid; grid-template-rows: auto 1fr }` — `<header>` is row 1, `.app` is row 2
- `.app { display: grid; grid-template-columns: 250px 1fr }` — `aside.sidebar` then `main`
- `main { display: grid; grid-template-rows: auto auto 1fr }` with `.controls`, `.banner`
  and `.lines` pinned to explicit `grid-row` values
- `.lines.blurred p.spoken .text`, `.lines p.current .ring .ring-fill`, and similar
  descendant chains

Any wrapper element Angular inserts between these breaks the layout. Therefore:

**Components that stand in for an existing element use attribute selectors**, so the
component *becomes* that element rather than nesting inside it:

```ts
@Component({ selector: 'aside[appTopicList]', /* renders as <aside class="sidebar"> */ })
@Component({ selector: 'main[appPractice]' })
@Component({ selector: 'div[appLineList]' })
@Component({ selector: 'svg[appProgressRing]' })
```

The emitted DOM tree is then equivalent to today's. The stylesheet moves to
`src/styles.css` with exactly **one** added rule, for the unavoidable `<app-root>`:

```css
app-root { display: contents; }
```

No component declares its own styles; all styling stays global. This is deliberate — view
encapsulation would require rewriting all 270 lines.

## Architecture

Six layers. Each is testable without the layer above it.

### `src/app/core/` — pure TypeScript, zero Angular imports

`core.js` splits by concern:

| Module | Exports |
| --- | --- |
| `text.ts` | `stripTags` |
| `deck.ts` | `deckOptions`, `linesFor` |
| `shuffle.ts` | `shuffle(list, rng?)` |
| `timing.ts` | `pauseMs`, `safetyTimeoutMs`, `nextIndex`, `formatClock` |
| `voice.ts` | `pickVoice`, `hasEnglishVoice`, `isEnglish` |
| `scoring.ts` | `normalizeSpeech`, `wordSimilarity`, `starsFor` |

Tested with bare Vitest, no TestBed. The 42 assertions in `core.test.js` port nearly
verbatim.

### `src/app/data/corpus.ts` — the typed corpus

```ts
export interface Deck { readonly id: string; readonly name: string; readonly lines: readonly string[]; }
export interface Corpus { readonly generatedAt: string; readonly decks: readonly Deck[]; }
export const CORPUS: Corpus = { /* 24 decks, 2242 lines */ };
```

### `src/app/platform/` — Web APIs behind injection tokens

This is where testability is won. Every `window` touch becomes an injectable seam:

| Token / service | Wraps | Why it needs a seam |
| --- | --- | --- |
| `SPEECH_SYNTHESIS` | `window.speechSynthesis` | Resolved at *injection* time, not import time, so the existing Playwright fake keeps working |
| `Speaker` | `SpeechSynthesisUtterance` + safety timeout | Lets playback tests resolve an utterance instantly |
| `SPEECH_RECOGNITION` | Port of `stt.js` | Fakeable recognition sessions |
| `MicrophoneService` | `navigator.mediaDevices.getUserMedia` | Denial latch and pending guard become testable |
| `STORAGE` | `localStorage` | Covers the private-mode throwing path |
| `Clock` | `Date.now`, `performance.now`, `setTimeout` | Playback loop runs on fake timers |

### `src/app/state/` — signal stores, one per concern

The 29-field mutable `state` bag splits into six stores. Ownership rule, to keep the split
unambiguous: **`SettingsStore` owns every value that persists; the other stores own only
transient state and derive the rest.** No value is writable from two places.

- **`SettingsStore`** — the seven persisted scalars: `deckId`, `rate`, `slack`,
  `voiceName`, `durationMin`, `blur`, `sttEnabled`. Written by a single `effect()`,
  replacing the eight scattered `saveSettings()` calls. Same `shadowing.settings` key,
  same JSON shape.
- **`PracticeStore`** — transient practice state only: `index`, `playing`, `order`
  (`null` for natural order, or a shuffled array of indices), and `spokenIndices`.
  `lines` is a `computed()` over `linesFor(CORPUS, settings.deckId())` and `order`.
  Methods: `selectDeck` (delegates the write to `SettingsStore`), `next`, `prev`,
  `shuffle`, `goTo`. `order`, `index` and `spokenIndices` all reset on deck change and on
  shuffle, matching today's full `renderLines()` rebuild.
- **`SessionTimerStore`** — transient timing only: `remainingMs`, `resumedAt`,
  `spokenCount`, a computed `clockText`, and `accrue()` / `expired()` / `finish()`. Reads
  `durationMin` from `SettingsStore` rather than storing its own copy.
- **`VoiceStore`** — `voices` signal fed by `voiceschanged`, computed `englishVoices`
  and `selected`.
- **`BannerStore`** — `{ html, source }` signal with `show(html, source)` and
  `clear(source)`, preserving the source guard: `clear` is a no-op unless the caller owns
  the banner.
- **`ValidationStore`** — per-line transcript text and star rating.

### `src/app/playback/PlaybackService` — the hard port

`runLoop` keeps its generation-counter cancellation protocol. With `Speaker` and `Clock`
injected, its behavior becomes unit-testable for the first time. Semantics to preserve
exactly:

1. `bump()` = increment generation, clear the gap timer, clear validation, resolve any
   pending wait, `synth.cancel()`. Every transport control depends on this.
2. `speak()` settles on `end`, `error`, or `safetyTimeoutMs(text, rate)` — whichever fires
   first, once only. `synth.cancel()` runs before `speak`.
3. Dead-voice heuristic: `speechMs < 150 && text.length > 15` increments `speechFailures`;
   three consecutive failures stop playback and raise the `dead-voice` banner.
4. `spokenCount` increments only on a *successful* speak.
5. Gap duration is `max(400, pauseMs(elapsedMs, slack))`.
6. When the validator is enabled, the STT promise **races** the gap timer — whichever
   resolves first ends the gap.
7. The `spoken` class lands on the line just passed, *then* the index advances via
   wrapping `nextIndex`.
8. Session expiry is checked **twice**: after the speak and after the gap.

`PlaybackService` exposes a `progress` signal (0 → 1) for the gap ring, replacing the
30 lines of `createElementNS` in `app.js`.

### `src/app/ui/` — presentational components

`HeaderBar`, `DurationPicker`, `TopicList`, `TransportControls`, `SettingsSliders`,
`BannerView`, `LineList`, `ProgressRing`, `ValidateBox`, `HelpModal`, `EdgeTip`, plus a
`ShortcutsDirective` for the keyboard map. Inputs in, outputs out; no component reads the
DOM, and nothing writes to the DOM outside a template.

### `DebugBridge`

The Playwright specs read `window.__shadowing.state.index`. A `DebugBridge` republishes
that exact shape from the signals, so all 15 specs pass with only the URL changed.

## Data flow

One direction: **component output → store method → signal → template**.

Bootstrap mirrors today's `init()` in order:

1. `SettingsStore` reads `shadowing.settings`.
2. `VoiceStore` loads voices and subscribes to `voiceschanged`.
3. `PracticeStore.selectDeck(saved.deckId ?? 'all')`, falling back to `'all'` when the
   saved deck resolves to zero lines.
4. `EdgeTip` checks user agent, `pointer: fine`, and the `shadowing.edgeTip` key.
5. Speech-unsupported and no-English-voice checks push into `BannerStore`.

Three things stop being imperative:

- **Persistence** — one `effect()` instead of eight `saveSettings()` calls.
- **The clock** — `setInterval(tickClock, 250)` becomes a `ticker` signal bumped every
  250 ms, with `clockText` a `computed()` over it. Same cadence, no DOM writes.
- **The ring** — a `progress` signal bound to `stroke-dashoffset` in an 8-line template.

Derived values are computed, not stored: `clockText`, `deckOptions`, `englishVoices`.

## Error handling — parity checklist

Every guard below exists today and must survive. None is currently reachable from a unit
test; all become so.

- No `speechSynthesis` → `unsupported` banner, transport disabled.
- No English voice → stop, `no-voice` banner, transport disabled; banner clears when
  voices arrive.
- Dead voice (three consecutive failures) → stop, `dead-voice` banner.
- Microphone denied → `sttDenied` latch, one-time banner, **no re-prompt** for the
  session (commit `bb87d69`).
- `micPending` guard against the double-prompt race (same commit).
- STT error codes: `aborted` ignored; `not-allowed` and `service-not-allowed` mark denial;
  anything else shows "Could not listen — validation skipped".
- Empty transcript → "No speech detected", no stars.
- Banner source guard: `clear(source)` no-ops unless that source owns the banner.
- `localStorage` throwing (private mode) is swallowed on both read and write.
- Keyboard: ignored when focus is in `INPUT`/`SELECT`/`TEXTAREA`; ignored on
  Alt/Ctrl/Meta and on `repeat`; `Escape` closes the modal; the double-press-`ArrowLeft`
  window is 500 ms.
- `synth.resume()` keepalive every 10 s (Chrome pause bug).
- Microphone released on `pagehide` and `beforeunload`.

### Accepted behavior deletions

**The "`data/data.js` not found" banner is dropped.** With a static import a missing corpus
fails the build instead of the app. No test covers this path.

**Three `data.test.js` assertions are dropped**, because they constrain the *generated
file's encoding* rather than the corpus itself:

- "the file on disk is pure ASCII"
- "escapes the two non-ASCII characters of the corpus" (`—`, `é`)
- "build script rejects uppercase tags" — already skipped in CI, since it shells out to
  `scripts/build.ps1` with a gitignored fixture

The `<b>`-only tag whitelist test **is kept**, and it stays valuable: it is the invariant
that made `innerHTML` rendering safe. Angular's `[innerHTML]` additionally routes through
`DomSanitizer`, so the new app is strictly safer than the old one on this axis.

### Out-of-repo follow-up

`scripts/build.ps1` and `scripts/cards-chunks.json` are gitignored and absent from this
repo. That script generates `data/data.js` from Anki cards and enforces the `<b>`
whitelist at build time. **It must be updated to emit `src/app/data/corpus.ts` instead**,
or the corpus becomes hand-maintained. This work is outside this repo and outside this
plan; it is called out so it is not forgotten.

## Testing strategy

| Tier | Runner | Coverage |
| --- | --- | --- |
| Pure | Vitest, no TestBed | `core/*` and corpus shape. Ports `core.test.js` (42) and six of nine `data.test.js` assertions. |
| Services | Vitest + TestBed + fakes + `vi.useFakeTimers()` | **New coverage.** `PlaybackService`: advance, wrap, cancel-on-bump, dead voice at three failures, expiry at both checkpoints, the 400 ms gap floor, STT racing the gap. `SettingsStore` round-trip and throwing storage. `SessionTimerStore` countdown vs count-up, expiry, finish-resets. `MicrophoneService` denial latch, no re-prompt, pending guard. `BannerStore` source guard. `SpeechRecognitionAdapter` — ports `stt.test.js` (10). |
| Components | Vitest + TestBed | `LineList` numbering from 1 and `<b>` markup; `ProgressRing` dash-offset from `progress`; `TransportControls` `aria-pressed`; `HelpModal` focus restore; `ValidateBox` star rendering; `DurationPicker` `aria-pressed`. |
| E2E | Playwright, **specs unchanged** | `webServer` replaces the `file://` URL. |

`tests/helpers/fake-audio.ts` needs **no change**: the adapter resolves
`window.speechSynthesis` at injection time, so an init script that patches it before
navigation still wins.

## Build and deploy

- `ng build --base-href ./` → `dist/shadowing/browser`. The relative base href serves
  correctly from both `/` locally and `/Shadowing/` on GitHub Pages. The app has no
  routing, so there is no deep-link concern.
- `src/index.html` keeps the Cloudflare Web Analytics beacon tag verbatim.
- `css/style.css` → `src/styles.css` plus the one `app-root { display: contents }` rule.
- Playwright gains a `webServer` block serving `dist/shadowing/browser`; ES modules cannot
  load over `file://`, so a server is required regardless of base href.
- CI becomes: `npm ci` → `ng build` → `npm test` → `npx playwright test` → upload
  `dist/shadowing/browser`. The `mkdir _site && cp -r ...` step is deleted.
- `.gitignore` gains `dist/` and `.angular/`.

## Migration sequence

Each step ends with a green suite. Steps 1–6 do not touch the running app at all; the
vanilla app keeps deploying throughout.

1. **Scaffold** Angular 22 into the repo root. Vanilla files left in place and still
   deploying. `style.css` copied to `src/styles.css`.
2. **`core/`** — six pure modules, with `core.test.js` ported to Vitest.
3. **`data/corpus.ts`** — converted corpus, asserted at 24 decks in order and 2242 lines
   total, with the `<b>`-only whitelist preserved.
4. **`platform/`** — adapters and tokens; `stt.test.js` ports here.
5. **`state/`** — the six signal stores, with tests.
6. **`playback/`** — `PlaybackService` and its tests. The largest single coverage gain.
7. **UI, in five slices**, each unlocking named Playwright specs:
   - **7a** shell, `TopicList`, `LineList` → specs 1, 3, 4, 5, 11
   - **7b** `TransportControls`, `ProgressRing`, `DurationPicker`, `BannerView`,
     `DebugBridge` → specs 2, 6, 7, 14, 15
   - **7c** blur mode → specs 8, 9, 13
   - **7d** `HelpModal`, `EdgeTip` → specs 10, 12
   - **7e** `ValidateBox` and the mic flow → no existing spec; covered by new unit tests
8. **Delete vanilla** — remove `index.html`, `css/`, `js/`, `data/data.js` and the old
   `tests/*.test.js`; rewrite `ci.yml` and `README.md`. One reviewable commit.

## Success criteria

- All 15 Playwright specs pass against the Angular build, with only the URL changed.
- All 58 ported unit assertions pass under Vitest — 42 from `core.test.js`, 10 from
  `stt.test.js`, and six of nine from `data.test.js`.
- New service-level tests cover all eight preserved `runLoop` semantics and every entry in
  the error-handling checklist.
- `dist/shadowing/browser` deploys to GitHub Pages and behaves identically to the current
  site, including the Cloudflare beacon.
- No file in `src/app/` exceeds roughly 150 lines; `app.js`'s 843 lines are gone.
