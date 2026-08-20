import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { SafeStorage } from '../platform/storage';
import { CATALOG } from './catalog-token';
import { CustomTopicStore } from './custom-topic-store';
import { PracticeStore } from './practice-store';
import { SettingsStore } from './settings-store';
import { NO_SHUFFLE, signedOutBackend, storedProfile, TEST_CATALOG } from '../testing/catalog';
import type { Catalog } from '../core/catalog';
import { RANDOM } from '../platform/rng';

const DATA = TEST_CATALOG;

function setup() {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      ...signedOutBackend(),
      {
        provide: SafeStorage,
        useValue: storedProfile() as unknown as SafeStorage,
      },
      { provide: CATALOG, useValue: DATA },
      { provide: RANDOM, useValue: NO_SHUFFLE },
    ],
  });
  return {
    store: TestBed.inject(PracticeStore),
    settings: TestBed.inject(SettingsStore),
    custom: TestBed.inject(CustomTopicStore),
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
    expect(store.lines()).toEqual(['a1', 'a2', 'a3', 'b1']);
    store.toggleTopic('a');
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
    expect(setup().store.lines()).toEqual(['a1', 'a2', 'a3', 'b1']);
  });

  it('narrows to a deck and drives the settings store', () => {
    const { store, settings } = setup();
    store.toggleTopic('b');
    expect(store.lines()).toEqual(['b1']);
    expect(settings.topicId()).toBe('b');
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

  it('selectTopic with no topic practises the whole level', () => {
    const { store } = setup();
    store.toggleTopic('b');
    store.selectTopic(null);
    expect(store.topicId()).toBeNull();
    expect(store.lines()).toEqual(['a1', 'a2', 'a3', 'b1']);
  });

  it('offers the topics present at the level, and no All entry', () => {
    const topics = setup().store.topics();
    expect(topics).toEqual([{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }]);
    expect(topics.map((t) => t.id)).not.toContain('all');
  });

  it('reports whether there is anything to practise', () => {
    const { store } = setup();
    expect(store.hasLines()).toBe(true);
    store.toggleTopic('missing');
    expect(store.hasLines()).toBe(false);
  });
});

describe('PracticeStore progressive rendering', () => {
  const many: Catalog = {
    loadedAt: '2026-08-06T00:00:00Z',
    levels: [{ id: 'A2', description: 'Elementary' }],
    topics: [{ id: 'big', name: 'Big' }],
    sentences: Array.from({ length: 200 }, (_, i) => ({
      id: `s-${i}`, topicId: 'big', levelId: 'A2', text: `line ${i}`,
    })),
  };

  function withMany() {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        ...signedOutBackend(),
        {
          provide: SafeStorage,
          useValue: storedProfile() as unknown as SafeStorage,
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
    store.toggleTopic('big');
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
    store.toggleTopic('a');
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
    store.toggleTopic('a');
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

  it('keeps a manual shuffle in force when the topic filter changes', () => {
    const { store } = setup();
    store.shuffleLines(() => 0);
    store.toggleTopic('a');

    expect([...store.lines()].sort()).toEqual(['a1', 'a2', 'a3']);
    expect(store.index()).toBe(0);
  });
});
