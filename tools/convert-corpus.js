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
