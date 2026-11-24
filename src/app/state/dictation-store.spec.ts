import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { SafeStorage } from '../platform/storage';
import { CATALOG } from './catalog-token';
import { CustomTopicStore } from './custom-topic-store';
import { SettingsStore } from './settings-store';
import { SENTENCE_IDS, ProgressService } from '../data/progress-service';
import { NO_SHUFFLE, signedOutBackend, storedSettings, TEST_CATALOG } from '../testing/catalog';
import { RANDOM } from '../platform/rng';
import { DictationStore } from './dictation-store';
import { PracticeStore } from './practice-store';

beforeEach(() => {
  for (const key of Object.keys(localStorage).filter((k) => k.startsWith('shadowing.'))) {
    localStorage.removeItem(key);
  }
});

function setup() {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      ...signedOutBackend(),
      { provide: SafeStorage, useValue: storedSettings() as unknown as SafeStorage },
      { provide: CATALOG, useValue: TEST_CATALOG },
      { provide: RANDOM, useValue: NO_SHUFFLE },
      {
        provide: SENTENCE_IDS,
        useValue: new Map([['a1', 's-a1'], ['a2', 's-a2'], ['a3', 's-a3']]),
      },
    ],
  });
  const store = TestBed.inject(DictationStore);
  const practice = TestBed.inject(PracticeStore);
  practice.selectTopic('a');
  TestBed.inject(ProgressService).startSession('dictation', 'a', 10);
  return { store, practice, settings: TestBed.inject(SettingsStore) };
}

describe('DictationStore', () => {
  it('starts all challenges todo at index 0', () => {
    const { store } = setup();
    expect(store.index()).toBe(0);
    expect(store.status(0)).toBe('todo');
  });

  it('marks an exact typed match correct and reveals it when show-answer-immediately', () => {
    const { store } = setup();
    expect(store.check('a1')).toBe('correct');
    expect(store.status(0)).toBe('correct');
    expect(store.revealed().has(0)).toBe(true);
  });

  it('marks a mismatch (or empty) incorrect and masks the answer', () => {
    const { store } = setup();
    store.showAnswerImmediately.set(false);
    expect(store.check('nothing typed')).toBe('incorrect');
    expect(store.status(0)).toBe('incorrect');
    expect(store.revealed().has(0)).toBe(false);
  });

  it('skip reveals and advances even early', () => {
    const { store } = setup();
    store.skip();
    expect(store.status(0)).toBe('incorrect');
    expect(store.revealed().has(0)).toBe(true);
    expect(store.index()).toBe(1);
  });

  it('next wraps and back clamps at zero; goTo jumps', () => {
    const { store } = setup();
    store.next(); store.next(); store.next();
    expect(store.index()).toBe(0);
    store.back();
    expect(store.index()).toBe(0);
    store.goTo(2);
    expect(store.index()).toBe(2);
  });

  it('challenge text comes from the practice lines', () => {
    const { store } = setup();
    expect(store.lines()).toEqual(['a1', 'a2', 'a3']);
  });

  it('retry clears the verdict and reveal without recording another attempt', () => {
    const { store } = setup();
    store.showAnswerImmediately.set(true);
    store.check('nope');
    store.showFull.set(true);

    const attempts = () =>
      JSON.parse(localStorage.getItem('shadowing.attempts') ?? '[]') as unknown[];
    const before = attempts().length;
    expect(before).toBe(1);

    store.retry();

    expect(store.status(0)).toBe('todo');
    expect(store.revealed().has(0)).toBe(false);
    expect(store.showFull()).toBe(false);
    expect(store.index()).toBe(0);
    expect(attempts().length).toBe(before);
  });
});