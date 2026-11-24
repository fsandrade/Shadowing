#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = path.resolve(__dirname, '..');
const CORPUS_TS = path.join(ROOT, 'src', 'app', 'data', 'corpus.ts');
const OUT = path.join(ROOT, 'src', 'app', 'data', 'corpus-meta.ts');

const NAMESPACE = 'b7c9f0a2-3e41-4f8d-9a6b-1d2e3f405162';

function uuidV5(name) {
  const ns = Buffer.from(NAMESPACE.replace(/-/g, ''), 'hex');
  const hash = crypto
    .createHash('sha1')
    .update(Buffer.concat([ns, Buffer.from(name, 'utf8')]))
    .digest();
  const bytes = Buffer.from(hash.subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return [
    hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16),
    hex.slice(16, 20), hex.slice(20, 32),
  ].join('-');
}

function readCorpus() {
  const src = fs.readFileSync(CORPUS_TS, 'utf8');
  const start = src.indexOf('{', src.indexOf('export const CORPUS'));
  const end = src.lastIndexOf('}');
  if (start < 0 || end < start) {
    throw new Error(`Could not locate the CORPUS object literal in ${CORPUS_TS}`);
  }
  return JSON.parse(src.slice(start, end + 1));
}

function main() {
  const corpus = readCorpus();
  const byContent = new Set();
  const deckIds = {};
  let sentenceCount = 0;

  for (const deck of corpus.decks) {
    const ids = [];
    for (const content of deck.lines) {
      if (byContent.has(content)) {
        throw new Error(`Duplicate sentence content: ${content}`);
      }
      byContent.add(content);
      ids.push(uuidV5(`sentence:${deck.id}:${content}`));
      sentenceCount++;
    }
    deckIds[deck.id] = ids;
  }

  const out = `export const DECK_SENTENCE_IDS: Readonly<Record<string, readonly string[]>> = ${JSON.stringify(
    deckIds,
    null,
    2
  )};

export const DECKS = ${JSON.stringify(
    corpus.decks.map((d) => ({ id: d.id, name: d.name })),
    null,
    2
  )};

`;

  fs.writeFileSync(OUT, out, 'utf8');
  console.log(`Wrote ${path.relative(ROOT, OUT)}: ${sentenceCount} sentences, ${corpus.decks.length} decks.`);
}

main();
