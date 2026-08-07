

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

const DATA_FILE = path.join(__dirname, '..', 'data', 'data.js');


global.window = {};
require(DATA_FILE);
const data = global.window.SHADOWING;


const EXPECTED = [
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

test('exposes generatedAt as an ISO-ish UTC stamp', () => {
  assert.match(data.generatedAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
});

test('has the 24 decks in file order with the right names and counts', () => {
  assert.strictEqual(data.decks.length, EXPECTED.length);
  data.decks.forEach((deck, i) => {
    const [id, name, count] = EXPECTED[i];
    assert.strictEqual(deck.id, id, `deck ${i} id`);
    assert.strictEqual(deck.name, name, `deck ${i} name`);
    assert.strictEqual(deck.lines.length, count, `deck ${id} line count`);
  });
});

test('has 2242 lines in total', () => {
  const total = data.decks.reduce((n, d) => n + d.lines.length, 0);
  assert.strictEqual(total, 2242);
});

test('contains no tag other than <b> and </b>', () => {
  for (const deck of data.decks) {
    for (const line of deck.lines) {
      for (const tag of line.match(/<[^>]*>/g) || []) {
        assert.ok(tag === '<b>' || tag === '</b>', `unexpected tag ${tag} in ${deck.id}: ${line}`);
      }
    }
  }
});

test('has no line that is empty once tags are stripped', () => {
  for (const deck of data.decks) {
    for (const line of deck.lines) {
      assert.ok(line.replace(/<[^>]*>/g, '').trim().length > 0, `empty line in ${deck.id}`);
    }
  }
});

test('keeps the highlighted chunk: most lines carry a <b> pair', () => {
  const withBold = data.decks.flatMap(d => d.lines).filter(l => l.includes('<b>')).length;
  assert.ok(withBold > 2000, `expected most of 2242 lines to be highlighted, got ${withBold}`);
});

test('the file on disk is pure ASCII', () => {
  const raw = fs.readFileSync(DATA_FILE, 'latin1');
  const bad = raw.match(/[^\x00-\x7F]/g);
  assert.strictEqual(bad, null, `non-ASCII bytes in the generated file: ${bad && bad.join(' ')}`);
});

test('escapes the two non-ASCII characters of the corpus', () => {
  const raw = fs.readFileSync(DATA_FILE, 'ascii');
  assert.ok(raw.includes('\\u2014'), 'em dash should appear escaped');
  assert.ok(raw.includes('\\u00e9'), 'e-acute should appear escaped');
});


// The tag whitelist in scripts/build.ps1 must be case-sensitive: only exactly
// '<b>' and '</b>' may pass, because this build-time abort is the sole guarantee
// that later innerHTML rendering is safe. The fixture is gitignored, so CI skips
// this test when it is not present.
test('build script rejects uppercase tags (case-sensitive whitelist)', (t) => {
  const cardsPath = path.join(__dirname, '..', 'scripts', 'cards-chunks.json');
  if (!fs.existsSync(cardsPath)) {
    t.skip('cards-chunks.json not present - build fixture not available');
    return;
  }
  const cards = JSON.parse(fs.readFileSync(cardsPath, 'utf8'));
  const before = cards[0].fields.Example1;
  assert.match(before, /<b>.*<\/b>/, 'fixture note is expected to carry a lowercase <b> pair');
  cards[0].fields.Example1 = before.replace('<b>', '<B>').replace('</b>', '</B>');

  const tmpCards = path.join(os.tmpdir(), `shadowing-test-cards-${process.pid}.json`);
  const tmpOut = path.join(os.tmpdir(), `shadowing-test-out-${process.pid}.js`);
  fs.writeFileSync(tmpCards, JSON.stringify(cards), 'utf8');

  try {
    const result = spawnSync('pwsh', [
      '-File', path.join(__dirname, '..', 'scripts', 'build.ps1'),
      '-CardsFile', tmpCards,
      '-OutFile', tmpOut,
    ], { encoding: 'utf8' });

    assert.strictEqual(result.error, undefined, `failed to spawn pwsh: ${result.error}`);
    assert.notStrictEqual(result.status, 0, `expected a non-zero exit, got ${result.status}\nstdout: ${result.stdout}\nstderr: ${result.stderr}`);
    assert.match(result.stderr, /<B>/, 'error output should name the offending uppercase tag');
    assert.ok(!fs.existsSync(tmpOut), 'a rejected build must not write an output file');
  } finally {
    fs.rmSync(tmpCards, { force: true });
    fs.rmSync(tmpOut, { force: true });
  }
});
