# Shadowing

A tool to practice **shadowing** and **chunking** — two well-known techniques for learning English.

- **Chunking**: break sentences into natural chunks and listen to how words group together in real English rhythm.
- **Shadowing**: listen to a sentence and repeat it right after, matching the speaker's pronunciation and speed.

Try it online: https://fsandrade.github.io/Shadowing/

## Development

An Angular 22 single-page app. Zoneless, standalone components, signal-based state.

```bash
npm install
npm start                  # ng serve on http://localhost:4200
npm test -- --watch=false  # Vitest unit tests
npm run test:e2e           # Playwright end-to-end tests
npm run build              # production build into dist/shadowing/browser
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

Two conventions worth knowing before editing:

- **Components use attribute selectors** (`aside[appTopicList]`, `main[appPractice]`)
  so each *becomes* an existing element rather than nesting inside one. The
  stylesheet's grid layout depends on that tree shape, so introducing a wrapper
  element inside `body`, `.app`, `main` or `.lines` will break the layout.
- **Test attribute-selector components through a host component.** `TestBed`
  ignores the element name in the selector and synthesises a `<div>`, hiding the
  very thing the stylesheet depends on.

## Corpus

`src/app/data/corpus.ts` is generated from Anki cards by `scripts/build.ps1`, which is
not part of this repo. That script enforces a `<b>`-only tag whitelist at build time —
the invariant that makes the corpus safe to render as markup.
`src/app/data/corpus.spec.ts` asserts the same property on the committed data.

**The generator still emits the pre-migration `data/data.js` format and needs
updating to write `src/app/data/corpus.ts` directly**, or the corpus becomes
hand-maintained.
