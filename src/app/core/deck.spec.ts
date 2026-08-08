import { describe, expect, it } from 'vitest';
import { type Corpus, deckOptions, linesFor } from './deck';

const DATA: Corpus = {
  generatedAt: '2026-08-06T00:00:00Z',
  decks: [
    { id: 'daily-life', name: 'Daily Life', lines: ['a <b>one</b>', 'b two'] },
    { id: 'meetings', name: 'Meetings', lines: ['c three'] },
  ],
};

describe('deckOptions', () => {
  it('puts All first with the grand total', () => {
    expect(deckOptions(DATA)[0]).toEqual({ id: 'all', name: 'All', count: 3 });
  });

  it('lists the decks in data order with their counts', () => {
    expect(deckOptions(DATA).slice(1)).toEqual([
      { id: 'daily-life', name: 'Daily Life', count: 2 },
      { id: 'meetings', name: 'Meetings', count: 1 },
    ]);
  });
});

describe('linesFor', () => {
  it('returns one deck', () => {
    expect(linesFor(DATA, 'meetings')).toEqual(['c three']);
  });

  it('concatenates every deck in order for "all"', () => {
    expect(linesFor(DATA, 'all')).toEqual(['a <b>one</b>', 'b two', 'c three']);
  });

  it('returns an empty list for an unknown deck', () => {
    expect(linesFor(DATA, 'nope')).toEqual([]);
  });

  it('does not hand back the internal array', () => {
    linesFor(DATA, 'meetings').push('mutated');
    expect(DATA.decks[1].lines.length).toBe(1);
  });
});
