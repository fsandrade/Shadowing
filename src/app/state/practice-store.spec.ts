import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { SafeStorage } from '../platform/storage';
import { CATALOG } from './catalog-token';
import { CustomTopicStore } from './custom-topic-store';
import { HistoryService } from '../data/history-service';
import { PracticeStore } from './practice-store';
import { SettingsStore } from './settings-store';
import { NO_SHUFFLE, signedOutBackend, storedSettings, TEST_CATALOG } from '../testing/catalog';
import type { Catalog } from '../core/catalog';
import { RANDOM } from '../platform/rng';

const DATA = TEST_CATALOG;

beforeEach(() => {
  for (const key of Object.keys(localStorage).filter((k) => k.startsWith('shadowing.'))) {
    localStorage.removeItem(key);
  }
});

function seedAttempts(attempts: unknown[]): void {
  localStorage.setItem('shadowing.attempts', JSON.stringify(attempts));
}

function attempt(
  sentenceId: string,
  stars: number | null,
  attemptedAt = new Date().toISOString(),
): Record<string, unknown> {
  return {
    sentenceId,
    status: stars === null ? 'failed' : 'scored',
    stars,
    attemptedAt,
  };
}

function setup() {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      ...signedOutBackend(),
      {
        provide: SafeStorage,
        useValue: storedSettings() as unknown as SafeStorage,
      },
      { provide: CATALOG, useValue: DATA },
      { provide: RANDOM, useValue: NO_SHUFFLE },
    ],
  });
  return {
    store: TestBed.inject(PracticeStore),
    settings: TestBed.inject(SettingsStore),
    custom: TestBed.inject(CustomTopicStore),
    history: TestBed.inject(HistoryService),
  };
}

describe('PracticeStore custom topic', () => {
  it('is not active for a corpus deck', () => {
    expect(setup().store.customActive()).toBe(false);
  });

  it('becomes active and empty when the custom topic is selected', () => {
    const { store } = setup();
    store.useCustomText();
    expect(store.customActive()).toBe(true);
    expect(store.lines()).toEqual([]);
    expect(store.hasLines()).toBe(false);
  });

  it('serves the custom sentences once there is text', () => {
    const { store, custom } = setup();
    custom.setText('One here. Two here!');
    store.useCustomText();
    expect(store.lines()).toEqual(['One here.', 'Two here!']);
    expect(store.hasLines()).toBe(true);
  });

  it('leaves the corpus decks untouched', () => {
    const { store, custom } = setup();
    custom.setText('Mine only.');
    expect(store.lines()).toEqual(['a1', 'a2', 'a3', 'b1', 'c1', 'c2']);
    store.selectTopic('a');
    expect(store.lines()).toEqual(['a1', 'a2', 'a3']);
  });

  it('refreshLines drops a stale shuffle and resets progress', () => {
    const { store, custom } = setup();
    custom.setText('One. Two. Three.');
    store.useCustomText();
    store.shuffleLines(() => 0);
    store.goTo(2);
    store.markSpoken(2);

    custom.setText('Only this one.');
    store.useCustomText();

    expect(store.lines()).toEqual(['Only this one.']);
    expect(store.index()).toBe(0);
    expect(store.spoken().size).toBe(0);
  });
});

describe('PracticeStore lines', () => {
  it('defaults to every line in deck order', () => {
    expect(setup().store.lines()).toEqual(['a1', 'a2', 'a3', 'b1', 'c1', 'c2']);
  });

  it('selectTopic pins one topic, returns to the catalog and resets progress', () => {
    const { store, settings } = setup();
    store.useCustomText();
    store.goTo(1);
    store.markSpoken(1);

    store.selectTopic('b');

    expect(settings.topicId()).toBe('b');
    expect(store.customActive()).toBe(false);
    expect(store.lines()).toEqual(['b1']);
    expect(store.index()).toBe(0);
    expect(store.spoken().size).toBe(0);
  });

  it('selectTopic with no topic practises the whole corpus', () => {
    const { store } = setup();
    store.selectTopic('b');
    store.selectTopic(null);
    expect(store.topicId()).toBeNull();
    expect(store.lines()).toEqual(['a1', 'a2', 'a3', 'b1', 'c1', 'c2']);
  });

  it('offers every topic that has sentences', () => {
    const topics = setup().store.topics();
    expect(topics).toEqual([
      { id: 'a', name: 'A' },
      { id: 'b', name: 'B' },
      { id: 'c', name: 'C' },
    ]);
  });

  it('reports whether there is anything to practise', () => {
    const { store } = setup();
    expect(store.hasLines()).toBe(true);
    store.selectTopic('missing');
    expect(store.hasLines()).toBe(false);
  });
});

describe('PracticeStore progressive rendering', () => {
  const many: Catalog = {
    loadedAt: '2026-08-06T00:00:00Z',    topics: [{ id: 'big', name: 'Big' }],
    sentences: Array.from({ length: 200 }, (_, i) => ({
      id: `s-${i}`, topicId: 'big', text: `line ${i}`,
    })),
  };

  function withMany() {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        ...signedOutBackend(),
        {
          provide: SafeStorage,
          useValue: storedSettings() as unknown as SafeStorage,
        },
        { provide: CATALOG, useValue: many },
      { provide: RANDOM, useValue: NO_SHUFFLE },
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
    store.selectTopic('big');
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

describe('PracticeStore study queue', () => {
  it('leaves mastered sentences out of the queue', () => {
    seedAttempts([attempt('s-a1', 5)]);
    const { store } = setup();
    store.selectTopic('a');
    expect(store.lines()).toEqual(['a2', 'a3']);
  });

  it('puts unseen sentences before weaker grades and stronger grades last', () => {
    seedAttempts([attempt('s-a1', 2), attempt('s-a2', 4)]);
    const { store } = setup();
    store.selectTopic('a');
    expect(store.lines()).toEqual(['a3', 'a1', 'a2']);
  });

  it('keeps the queue snapshot when history changes mid-session', () => {
    const { store, history } = setup();
    store.selectTopic('a');
    const running = [...store.lines()];

    seedAttempts([attempt('s-a1', 5)]);
    history.refresh();

    expect(store.lines()).toEqual(running);
  });

  it('rebuilds the queue when the topic changes', () => {
    seedAttempts([attempt('s-b1', 5)]);
    const { store } = setup();

    store.selectTopic('b');
    expect(store.lines()).toEqual([]);

    store.selectTopic('a');
    expect(store.lines()).toEqual(['a1', 'a2', 'a3']);
  });

  it('does not filter custom text through the queue', () => {
    seedAttempts([attempt('s-a1', 5)]);
    const { store, custom } = setup();
    custom.setText('Mine. Yours.');
    store.useCustomText();
    expect(store.lines()).toEqual(['Mine.', 'Yours.']);
  });
});

describe('PracticeStore remaining counts', () => {
  it('counts every unmastered sentence, overall and per topic', () => {
    seedAttempts([attempt('s-a1', 5)]);
    const { store } = setup();

    expect(store.remainingFor(null)).toBe(5);
    expect(store.remainingFor('a')).toBe(2);
    expect(store.remainingFor('b')).toBe(1);
    expect(store.remainingFor('c')).toBe(2);
  });

  it('reports nothing remaining for a fully mastered topic', () => {
    seedAttempts([attempt('s-a1', 5), attempt('s-a2', 5), attempt('s-a3', 5)]);
    const { store } = setup();

    expect(store.remainingFor('a')).toBe(0);
    expect(store.remainingFor(null)).toBe(3);
  });

  it('keeps a sentence that only failed attempts remain', () => {
    seedAttempts([attempt('s-a1', null)]);
    const { store } = setup();

    expect(store.remainingFor('a')).toBe(3);
  });

  it('updates when history refreshes', () => {
    const { store, history } = setup();
    expect(store.remainingFor('a')).toBe(3);

    seedAttempts([attempt('s-a1', 5)]);
    history.refresh();

    expect(store.remainingFor('a')).toBe(2);
  });
});

describe('PracticeStore navigation', () => {
  it('advances with wraparound', () => {
    const { store } = setup();
    store.selectTopic('a');
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
    store.selectTopic('a');
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
    expect([...store.lines()].sort()).toEqual(['a1', 'a2', 'a3', 'b1', 'c1', 'c2']);
    expect(store.lines()).not.toEqual(['a1', 'a2', 'a3', 'b1', 'c1', 'c2']);
  });

  it('keeps a manual shuffle in force when the topic filter changes', () => {
    const { store } = setup();
    store.shuffleLines(() => 0);
    store.selectTopic('a');

    expect([...store.lines()].sort()).toEqual(['a1', 'a2', 'a3']);
    expect(store.index()).toBe(0);
  });
});
