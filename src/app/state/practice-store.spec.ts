import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { type Corpus } from '../core/deck';
import { SafeStorage } from '../platform/storage';
import { CORPUS_DATA } from './corpus-token';
import { PracticeStore } from './practice-store';
import { SettingsStore } from './settings-store';

const DATA: Corpus = {
  generatedAt: '2026-08-06T00:00:00Z',
  decks: [
    { id: 'a', name: 'A', lines: ['a1', 'a2', 'a3'] },
    { id: 'b', name: 'B', lines: ['b1'] },
  ],
};

function setup() {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      {
        provide: SafeStorage,
        useValue: { read: () => null, write: () => {} } as unknown as SafeStorage,
      },
      { provide: CORPUS_DATA, useValue: DATA },
    ],
  });
  return {
    store: TestBed.inject(PracticeStore),
    settings: TestBed.inject(SettingsStore),
  };
}

describe('PracticeStore lines', () => {
  it('defaults to every line in deck order', () => {
    expect(setup().store.lines()).toEqual(['a1', 'a2', 'a3', 'b1']);
  });

  it('narrows to a deck and drives the settings store', () => {
    const { store, settings } = setup();
    store.selectDeck('b');
    expect(store.lines()).toEqual(['b1']);
    expect(settings.deckId()).toBe('b');
  });

  it('exposes deckOptions with All first', () => {
    expect(setup().store.deckOptions()[0]).toEqual({ id: 'all', name: 'All', count: 4 });
  });

  it('reports whether there is anything to practise', () => {
    const { store } = setup();
    expect(store.hasLines()).toBe(true);
    store.selectDeck('missing');
    expect(store.hasLines()).toBe(false);
  });
});

describe('PracticeStore navigation', () => {
  it('advances with wraparound', () => {
    const { store } = setup();
    store.selectDeck('a');
    store.advance();
    expect(store.index()).toBe(1);
    store.advance();
    store.advance();
    expect(store.index()).toBe(0);
  });

  it('steps back but never below zero', () => {
    const { store } = setup();
    store.goTo(1);
    store.back();
    expect(store.index()).toBe(0);
    store.back();
    expect(store.index()).toBe(0);
  });

  it('marks lines spoken', () => {
    const { store } = setup();
    store.markSpoken(0);
    store.markSpoken(2);
    expect(store.spoken().has(0)).toBe(true);
    expect(store.spoken().has(1)).toBe(false);
    expect(store.spoken().has(2)).toBe(true);
  });
});

describe('PracticeStore reset semantics', () => {
  it('selecting a deck resets index and spoken, matching the old full re-render', () => {
    const { store } = setup();
    store.goTo(2);
    store.markSpoken(0);
    store.selectDeck('a');
    expect(store.index()).toBe(0);
    expect(store.spoken().size).toBe(0);
  });

  it('shuffling reorders, resets index and spoken, and keeps every line', () => {
    const { store } = setup();
    store.goTo(3);
    store.markSpoken(0);
    store.shuffleLines(() => 0);

    expect(store.index()).toBe(0);
    expect(store.spoken().size).toBe(0);
    expect([...store.lines()].sort()).toEqual(['a1', 'a2', 'a3', 'b1']);
    expect(store.lines()).not.toEqual(['a1', 'a2', 'a3', 'b1']);
  });

  it('changing deck clears a previous shuffle', () => {
    const { store } = setup();
    store.shuffleLines(() => 0);
    store.selectDeck('a');
    expect(store.lines()).toEqual(['a1', 'a2', 'a3']);
  });
});
