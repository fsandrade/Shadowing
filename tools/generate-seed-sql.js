#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = path.resolve(__dirname, '..');
const CORPUS_TS = path.join(ROOT, 'src', 'app', 'data', 'corpus.ts');
const OUT_SQL = path.join(ROOT, 'supabase', 'seed.sql');

const NAMESPACE = 'b7c9f0a2-3e41-4f8d-9a6b-1d2e3f405162';

const LEVELS = [
  ['A1', 'Beginner'],
  ['A2', 'Elementary'],
  ['B1', 'Intermediate'],
  ['B2', 'Upper intermediate'],
  ['C1', 'Advanced'],
  ['C2', 'Proficient'],
];

const { classify } = require('./classify-level');

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
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
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

function buildRows(corpus) {
  const decks = [];
  const sentences = [];
  const seen = new Map();
  const byContent = new Map();

  corpus.decks.forEach((deck, position) => {
    decks.push({ id: deck.id, description: deck.name, position });

    deck.lines.forEach((content, linePosition) => {
      const id = uuidV5(`sentence:${deck.id}:${content}`);
      if (seen.has(id)) {
        throw new Error(
          `Duplicate sentence in deck "${deck.id}": ${content}\n`
          + `Collides with: ${seen.get(id)}`,
        );
      }
      seen.set(id, content);

      if (byContent.has(content)) {
        throw new Error(
          `Two sentences share the same text, in decks "${byContent.get(content)}" `
          + `and "${deck.id}":\n  ${content}\n`
          + `The app resolves a sentence to its row by text, so duplicates would `
          + `make progress ambiguous. Reword one of them.`,
        );
      }
      byContent.set(content, deck.id);

      sentences.push({
        id,
        deckId: deck.id,
        content,
        levelId: classify(content),
        position: linePosition,
      });
    });
  });

  if (!decks.length || !sentences.length) {
    throw new Error('Corpus produced no rows - refusing to write an empty seed.');
  }

  return { decks, sentences };
}

function quote(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function insertBlocks(table, columns, rows, toValues, conflict, batchSize = 200) {
  const batches = [];
  for (let i = 0; i < rows.length; i += batchSize) {
    batches.push(rows.slice(i, i + batchSize));
  }
  return batches
    .map((batch) => {
      const values = batch.map((row) => `  (${toValues(row).join(', ')})`).join(',\n');
      return `insert into ${table} (${columns.join(', ')}) values\n${values}\n${conflict};`;
    })
    .join('\n\n');
}

function render({ decks, sentences }) {
  const header = `-- GENERATED FILE - do not edit by hand.
-- Regenerate with: npm run db:seed
--
-- Teaching content for the Shadowing app: ${decks.length} decks and
-- ${sentences.length} sentences. Content is identical for every user.
--
-- Each sentence is classified on its own by tools/classify-level.js, from its
-- length and the frequency of the words it uses. A topic therefore spans
-- several levels. Re-running this file re-applies the current classification.
--
-- Safe to re-run. Ids are UUIDv5 values derived from the content, so replaying
-- this file updates existing rows in place and leaves user progress intact.
-- It never deletes: content removed from corpus.ts stays in the database until
-- you delete it deliberately, because deleting a sentence cascades away every
-- attempt recorded against it.

begin;
`;

  const levelSql = insertBlocks(
    'public.levels',
    ['id', 'description'],
    LEVELS,
    ([id, description]) => [quote(id), quote(description)],
    `on conflict (id) do update set
  description = excluded.description`,
  );

  const deckSql = insertBlocks(
    'public.decks',
    ['id', 'description', 'position'],
    decks,
    (d) => [quote(d.id), quote(d.description), d.position],
    `on conflict (id) do update set
  description = excluded.description,
  position = excluded.position`,
  );

  const sentenceSql = insertBlocks(
    'public.sentences',
    ['id', 'deck_id', 'content', 'level_id', 'position'],
    sentences,
    (s) => [
      quote(s.id), quote(s.deckId), quote(s.content), quote(s.levelId), s.position,
    ],
    `on conflict (id) do update set
  deck_id = excluded.deck_id,
  content = excluded.content,
  level_id = excluded.level_id,
  position = excluded.position`,
  );

  return [
    header,
    '-- Levels ----------------------------------------------------------------',
    levelSql,
    '',
    '-- Decks -----------------------------------------------------------------',
    deckSql,
    '',
    '-- Sentences -------------------------------------------------------------',
    sentenceSql,
    '',
    'commit;',
    '',
  ].join('\n');
}

function main() {
  const rows = buildRows(readCorpus());

  fs.mkdirSync(path.dirname(OUT_SQL), { recursive: true });
  fs.writeFileSync(OUT_SQL, render(rows), 'utf8');

  console.log(
    `Wrote ${path.relative(ROOT, OUT_SQL)}: `
    + `${LEVELS.length} levels, ${rows.decks.length} decks, `
    + `${rows.sentences.length} sentences.`,
  );
}

main();
