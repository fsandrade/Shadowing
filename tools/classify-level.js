const fs = require('node:fs');
const path = require('node:path');

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

const RANKS = (() => {
  const file = path.join(__dirname, 'english-frequency.txt');
  const words = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  const map = new Map();
  words.forEach((word, i) => {
    const w = word.trim().toLowerCase();
    if (w && !map.has(w)) { map.set(w, i); }
  });
  return map;
})();

const UNKNOWN_RANK = 9000;

const CONTRACTIONS = {
  "n't": 'not', "'re": 'are', "'ve": 'have', "'ll": 'will', "'m": 'am',
  "'d": 'would', "'s": 'is',
  gonna: 'going', wanna: 'want', gotta: 'got', kinda: 'kind', lemme: 'let',
  dunno: 'know', aint: 'are', yall: 'you', ok: 'okay',
};

function stripMarkup(text) {
  return String(text).replace(/<[^>]*>/g, '');
}

function tokenize(text) {
  return stripMarkup(text)
    .replace(/[‘’]/g, "'")
    .split(/[^A-Za-z']+/)
    .filter(Boolean)
    .map((t) => t.replace(/^'+|'+$/g, ''))
    .filter(Boolean);
}

function baseForms(token) {
  const w = token.toLowerCase();
  const out = [w];

  const apostrophe = w.indexOf("'");
  if (apostrophe > 0) {
    out.push(w.slice(0, apostrophe));
    const tail = w.slice(apostrophe);
    if (CONTRACTIONS[tail]) { out.push(CONTRACTIONS[tail]); }
  }
  if (CONTRACTIONS[w]) { out.push(CONTRACTIONS[w]); }

  if (w.endsWith('ies') && w.length > 4) { out.push(`${w.slice(0, -3)}y`); }
  if (w.endsWith('es') && w.length > 3) { out.push(w.slice(0, -2)); }
  if (w.endsWith('s') && w.length > 2) { out.push(w.slice(0, -1)); }
  if (w.endsWith('ed') && w.length > 3) {
    out.push(w.slice(0, -2), w.slice(0, -1));
    if (/(.)\1ed$/.test(w)) { out.push(w.slice(0, -3)); }
  }
  if (w.endsWith('ing') && w.length > 4) {
    out.push(w.slice(0, -3), `${w.slice(0, -3)}e`);
    if (/(.)\1ing$/.test(w)) { out.push(w.slice(0, -4)); }
  }
  if (w.endsWith('ly') && w.length > 4) { out.push(w.slice(0, -2)); }
  if (w.endsWith('er') && w.length > 4) { out.push(w.slice(0, -2), w.slice(0, -1)); }
  if (w.endsWith('est') && w.length > 5) { out.push(w.slice(0, -3)); }

  return out;
}

function rankOf(token) {
  let best = null;
  for (const form of baseForms(token)) {
    const rank = RANKS.get(form);
    if (rank !== undefined && (best === null || rank < best)) { best = rank; }
  }
  return best === null ? UNKNOWN_RANK : best;
}

function isName(token, index, total) {
  if (!/^[A-Z][a-z]+$/.test(token) || rankOf(token) !== UNKNOWN_RANK) { return false; }
  return index > 0 || total > 2;
}

const clamp = (x) => Math.max(0, Math.min(1, x));

const LENGTH_FLOOR = 4;
const LENGTH_SPAN = 16;
const MEAN_FLOOR = 1.70;
const MEAN_SPAN = 1.10;
const HARD_FLOOR = 2.30;
const HARD_SPAN = 1.70;

const SLANG = new Set([
  'gonna', 'wanna', 'gotta', 'kinda', 'sorta', 'dunno', 'lemme', 'gimme',
  'aint', 'yall', 'em', 'yeah', 'yep', 'nope', 'ok', 'okay', 'hey', 'wow',
  'huh', 'ugh', 'oh', 'eh', 'um', 'uh',
]);

const LENGTH_CEILING = [
  { upTo: 2, level: 0 },
  { upTo: 3, level: 1 },
  { upTo: 5, level: 2 },
  { upTo: 8, level: 3 },
  { upTo: 12, level: 4 },
];

const CUTOFFS = [0.245, 0.335, 0.425, 0.515, 0.615];

function colloquialLoad(tokens) {
  let hits = 0;
  for (const token of tokens) {
    const w = token.toLowerCase();
    if (w.includes("'")) { hits += 1; }
    if (SLANG.has(w)) { hits += 1; }
  }
  return clamp(hits / 2.5);
}

function ceilingFor(length) {
  for (const rule of LENGTH_CEILING) {
    if (length <= rule.upTo) { return rule.level; }
  }
  return LEVELS.length - 1;
}

function measure(text) {
  const tokens = tokenize(text);
  const vocabulary = tokens.filter((t, i) => !isName(t, i, tokens.length));
  const ranks = (vocabulary.length ? vocabulary : tokens).map(rankOf);

  const meanLog = ranks.reduce((sum, r) => sum + Math.log10(r + 10), 0)
    / Math.max(1, ranks.length);

  const descending = [...ranks].sort((a, b) => b - a);
  const hardest = ranks.length > 2
    ? Math.log10(descending[1] + 10)
    : meanLog;

  const colloquial = colloquialLoad(tokens);

  const score = 0.34 * clamp((tokens.length - LENGTH_FLOOR) / LENGTH_SPAN)
    + 0.34 * clamp((meanLog - MEAN_FLOOR) / MEAN_SPAN)
    + 0.14 * clamp((hardest - HARD_FLOOR) / HARD_SPAN)
    + 0.18 * colloquial;

  return { length: tokens.length, meanLog, hardest, colloquial, score };
}

function classify(text) {
  const { score, length } = measure(text);
  let index = CUTOFFS.length;
  for (let i = 0; i < CUTOFFS.length; i++) {
    if (score <= CUTOFFS[i]) { index = i; break; }
  }
  return LEVELS[Math.min(index, ceilingFor(length))];
}

module.exports = { classify, measure, rankOf, LEVELS };
