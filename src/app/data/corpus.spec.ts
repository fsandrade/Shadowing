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
