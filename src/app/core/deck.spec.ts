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
  it('puts All first', () => {
    expect(deckOptions(DATA)[0]).toEqual({ id: 'all', name: 'All' });
  });

  it('lists the decks in data order', () => {
    expect(deckOptions(DATA).slice(2)).toEqual([
      { id: 'daily-life', name: 'Daily Life' },
      { id: 'meetings', name: 'Meetings' },
    ]);
  });

  it('offers the custom topic up front, where it can be found', () => {
    expect(deckOptions(DATA).slice(0, 2)).toEqual([
      { id: 'all', name: 'All' },
      { id: 'custom', name: 'My text' },
    ]);
  });

  it('handles a corpus with no decks', () => {
    expect(deckOptions({ generatedAt: '', decks: [] })).toEqual([
      { id: 'all', name: 'All' },
      { id: 'custom', name: 'My text' },
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
