# Shadowing

A tool to practice **shadowing** and **chunking** — two well-known techniques for learning English.

- **Chunking**: break sentences into natural chunks and listen to how words group together in real English rhythm.
- **Shadowing**: listen to a sentence and repeat it right after, matching the speaker's pronunciation and speed.

Try it online: https://fsandrade.github.io/Shadowing/

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