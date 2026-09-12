import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { SafeStorage } from '../platform/storage';
import { CATALOG } from './catalog-token';
import { CustomTopicStore } from './custom-topic-store';
import { SettingsStore } from './settings-store';
import { NO_SHUFFLE, signedOutBackend, storedProfile, TEST_CATALOG } from '../testing/catalog';
import { RANDOM } from '../platform/rng';
import { DictationStore } from './dictation-store';
import { PracticeStore } from './practice-store';

function setup() {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      ...signedOutBackend(),
      { provide: SafeStorage, useValue: storedProfile() as unknown as SafeStorage },
      { provide: CATALOG, useValue: TEST_CATALOG },
      { provide: RANDOM, useValue: NO_SHUFFLE },
    ],
  });
  const store = TestBed.inject(DictationStore);
  const practice = TestBed.inject(PracticeStore);
  practice.selectTopic('a');
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
});