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

describe('PracticeStore progressive rendering', () => {
  const many: Corpus = {
    generatedAt: '2026-08-06T00:00:00Z',
    decks: [{
      id: 'big',
      name: 'Big',
      lines: Array.from({ length: 200 }, (_, i) => `line ${i}`),
    }],
  };

  function withMany() {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        {
          provide: SafeStorage,
          useValue: { read: () => null, write: () => {} } as unknown as SafeStorage,
        },
        { provide: CORPUS_DATA, useValue: many },
      ],
    });
    return TestBed.inject(PracticeStore);
  }

  it('renders only a first page, while lines() still holds everything', () => {
    const store = withMany();
    expect(store.lines().length).toBe(200);
    expect(store.visibleLines().length).toBe(60);
    expect(store.allRevealed()).toBe(false);
  });

  it('reveals another page on demand', () => {
    const store = withMany();
    store.revealMore();
    expect(store.visibleLines().length).toBe(120);
    store.revealMore();
    expect(store.visibleLines().length).toBe(180);
  });

  it('stops at the end of the list and reports everything revealed', () => {
    const store = withMany();
    for (let i = 0; i < 10; i++) { store.revealMore(); }
    expect(store.visibleLines().length).toBe(200);
    expect(store.allRevealed()).toBe(true);
    expect(() => store.revealMore()).not.toThrow();
  });

  it('reveals nothing extra when the deck already fits in a page', () => {
    const store = setup().store;
    expect(store.visibleLines().length).toBe(store.lines().length);
    expect(store.allRevealed()).toBe(true);
  });

  it('extends the window so a jumped-to line is rendered', () => {
    const store = withMany();
    store.goTo(150);
    expect(store.visibleLines().length).toBeGreaterThan(150);
    expect(store.visibleLines()[150]).toBe('line 150');
  });

  it('extends the window as playback advances past the edge', () => {
    const store = withMany();
    store.goTo(58);
    const before = store.visibleLines().length;
    store.advance();
    store.advance();
    expect(store.visibleLines().length).toBeGreaterThanOrEqual(before);
    expect(store.visibleLines()[store.index()]).toBe(`line ${store.index()}`);
  });

  it('collapses back to a single page on deck change', () => {
    const store = withMany();
    store.goTo(150);
    expect(store.visibleLines().length).toBeGreaterThan(60);
    store.selectDeck('big');
    expect(store.visibleLines().length).toBe(60);
  });

  it('collapses back to a single page on shuffle', () => {
    const store = withMany();
    store.revealMore();
    store.revealMore();
    store.shuffleLines(() => 0);
    expect(store.visibleLines().length).toBe(60);
    expect(store.lines().length).toBe(200);
  });

  it('keeps visible lines a prefix of the full order, so indexes still line up', () => {
    const store = withMany();
    store.revealMore();
    const all = store.lines();
    store.visibleLines().forEach((line, i) => {
      expect(line).toBe(all[i]);
    });
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
