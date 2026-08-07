const test = require('node:test');
const assert = require('node:assert');
const C = require('../js/core.js');

const DATA = {
  generatedAt: '2026-08-06T00:00:00Z',
  decks: [
    { id: 'daily-life', name: 'Daily Life', lines: ['a <b>one</b>', 'b two'] },
    { id: 'meetings', name: 'Meetings', lines: ['c three'] },
  ],
};

test('stripTags removes the chunk highlight and leaves the sentence', () => {
  assert.strictEqual(
    C.stripTags("I must've <b>hit the snooze button</b> like four times."),
    "I must've hit the snooze button like four times."
  );
});

test('stripTags is a no-op on plain text', () => {
  assert.strictEqual(C.stripTags('no markup here'), 'no markup here');
});

test('stripTags keeps stripping when a tag straddles another tag', () => {
  const out = C.stripTags('<sc<script>ript>alert(1)</sc<script>ript>');
  assert.ok(!out.includes('<'), 'no < remains');
  assert.ok(!out.includes('>'), 'no > remains');
  assert.ok(!out.toLowerCase().includes('script'), 'no script tag reassembles');
});

test('deckOptions puts All first with the grand total', () => {
  const opts = C.deckOptions(DATA);
  assert.deepStrictEqual(opts[0], { id: 'all', name: 'All', count: 3 });
});

test('deckOptions lists the decks in data order with their counts', () => {
  assert.deepStrictEqual(C.deckOptions(DATA).slice(1), [
    { id: 'daily-life', name: 'Daily Life', count: 2 },
    { id: 'meetings', name: 'Meetings', count: 1 },
  ]);
});

test('linesFor returns one deck', () => {
  assert.deepStrictEqual(C.linesFor(DATA, 'meetings'), ['c three']);
});

test('linesFor("all") concatenates every deck in order', () => {
  assert.deepStrictEqual(C.linesFor(DATA, 'all'), ['a <b>one</b>', 'b two', 'c three']);
});

test('linesFor returns an empty list for an unknown deck', () => {
  assert.deepStrictEqual(C.linesFor(DATA, 'nope'), []);
});

test('linesFor does not hand back the internal array', () => {
  const lines = C.linesFor(DATA, 'meetings');
  lines.push('mutated');
  assert.strictEqual(DATA.decks[1].lines.length, 1);
});

test('shuffle keeps every element exactly once', () => {
  const input = ['a', 'b', 'c', 'd', 'e'];
  const out = C.shuffle(input, () => 0.5);
  assert.deepStrictEqual([...out].sort(), [...input].sort());
});

test('shuffle returns a new array and leaves the input alone', () => {
  const input = ['a', 'b', 'c'];
  const out = C.shuffle(input, () => 0);
  assert.notStrictEqual(out, input);
  assert.deepStrictEqual(input, ['a', 'b', 'c']);
});

test('shuffle applies the rng to the algorithm, not just the input', () => {
 
 
 
 
 
  const seq = [0.1, 0.2, 0.3, 0.4];
  let i = 0;
  const rng = () => seq[i++];
  const result = C.shuffle(['a', 'b', 'c', 'd', 'e'], rng);
  assert.deepStrictEqual(result, ['b', 'c', 'd', 'e', 'a']);
});

test('different rng sequences produce different permutations', () => {
  const seq1 = [0.1, 0.2, 0.3, 0.4];
  const seq2 = [0.9, 0.8, 0.7, 0.6];
  let i = 0;
  const rng1 = () => seq1[i++];
  const result1 = C.shuffle(['a', 'b', 'c', 'd', 'e'], rng1);
  i = 0;
  const rng2 = () => seq2[i++];
  const result2 = C.shuffle(['a', 'b', 'c', 'd', 'e'], rng2);
  assert.notDeepStrictEqual(result1, result2);
});

test('shuffle guards against rng returning exactly 1.0', () => {
  const result = C.shuffle(['a', 'b', 'c', 'd', 'e'], () => 1.0);
  assert.strictEqual(result.length, 5);
  assert.deepStrictEqual([...result].sort(), ['a', 'b', 'c', 'd', 'e'].sort());
});

test('shuffle handles the empty list', () => {
  assert.deepStrictEqual(C.shuffle([], Math.random), []);
});



test('pauseMs is the speech duration times the slack', () => {
  assert.strictEqual(C.pauseMs(4000, 1.0), 4000);
  assert.strictEqual(C.pauseMs(4000, 1.5), 6000);
  assert.strictEqual(C.pauseMs(4000, 0.8), 3200);
});

test('pauseMs rounds to whole milliseconds', () => {
  assert.strictEqual(C.pauseMs(3333, 1.15), 3833);
});

test('pauseMs never returns a negative wait', () => {
  assert.strictEqual(C.pauseMs(-100, 1.0), 0);
});

test('safetyTimeoutMs allows the sentence plus a five second margin', () => {
 
  assert.strictEqual(C.safetyTimeoutMs('x'.repeat(56), 1.0), 9667);
});

test('safetyTimeoutMs grows as the rate slows down', () => {
  const slow = C.safetyTimeoutMs('x'.repeat(60), 0.7);
  const fast = C.safetyTimeoutMs('x'.repeat(60), 1.2);
  assert.ok(slow > fast, `${slow} should exceed ${fast}`);
});

test('safetyTimeoutMs still gives an empty string the margin', () => {
  assert.strictEqual(C.safetyTimeoutMs('', 1.0), 5000);
});

test('nextIndex wraps at the end of the list', () => {
  assert.strictEqual(C.nextIndex(0, 3), 1);
  assert.strictEqual(C.nextIndex(2, 3), 0);
});

test('nextIndex returns 0 for an empty list', () => {
  assert.strictEqual(C.nextIndex(0, 0), 0);
});

test('formatClock renders MM:SS', () => {
  assert.strictEqual(C.formatClock(462), '07:42');
  assert.strictEqual(C.formatClock(0), '00:00');
  assert.strictEqual(C.formatClock(9), '00:09');
});

test('formatClock clamps negatives to zero', () => {
  assert.strictEqual(C.formatClock(-5), '00:00');
});

test('formatClock keeps counting in minutes past an hour', () => {
  assert.strictEqual(C.formatClock(4500), '75:00');
});



const VOICES = [
  { name: 'Microsoft Maria', lang: 'pt-BR' },
  { name: 'Google UK English Male', lang: 'en-GB' },
  { name: 'Microsoft Zira', lang: 'en-US' },
  { name: 'Microsoft Ava (Natural)', lang: 'en-US' },
];

test('pickVoice honours a remembered voice by name', () => {
  assert.strictEqual(C.pickVoice(VOICES, 'Microsoft Zira').name, 'Microsoft Zira');
});

test('pickVoice falls through when the remembered voice is gone', () => {
  assert.strictEqual(C.pickVoice(VOICES, 'Uninstalled Voice').name, 'Microsoft Ava (Natural)');
});

test('pickVoice prefers a Natural en-US voice', () => {
  assert.strictEqual(C.pickVoice(VOICES).name, 'Microsoft Ava (Natural)');
});

test('pickVoice falls back to any en-US voice', () => {
  const noNatural = VOICES.filter(v => !v.name.includes('Natural'));
  assert.strictEqual(C.pickVoice(noNatural).name, 'Microsoft Zira');
});

test('pickVoice falls back to any English voice', () => {
  const onlyGb = [VOICES[0], VOICES[1]];
  assert.strictEqual(C.pickVoice(onlyGb).name, 'Google UK English Male');
});

test('pickVoice falls back to the first voice when no English one exists', () => {
  assert.strictEqual(C.pickVoice([VOICES[0]]).name, 'Microsoft Maria');
});

test('pickVoice returns null when there are no voices at all', () => {
  assert.strictEqual(C.pickVoice([]), null);
});

test('hasEnglishVoice detects the presence of an en-* voice', () => {
  assert.strictEqual(C.hasEnglishVoice(VOICES), true);
  assert.strictEqual(C.hasEnglishVoice([VOICES[0]]), false);
  assert.strictEqual(C.hasEnglishVoice([]), false);
});
