import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { localDay } from '../core/days';
import { SafeStorage } from '../platform/storage';
import { BannerStore } from '../state/banner-store';
import { MESSAGES } from '../state/messages';
import { SettingsStore } from '../state/settings-store';
import { HistoryService } from './history-service';
import { PROGRESS_KEY, RECENT_ATTEMPTS_KEY } from './progress-storage';
import { SENTENCE_IDS, type Attempt, ProgressService } from './progress-service';

const LINE = 'I must\'ve <b>hit the snooze button</b> like four times this morning.';
const PLAIN = 'I must\'ve hit the snooze button like four times this morning.';

function setup(
  sentenceIds: Map<string, string> = new Map([[LINE, 'sentence-uuid']]),
  storage?: SafeStorage,
) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: SENTENCE_IDS, useValue: sentenceIds },
      ...(storage ? [{ provide: SafeStorage, useValue: storage }] : []),
    ],
  });

  return {
    progress: TestBed.inject(ProgressService),
  };
}

const scored: Attempt = {
  line: LINE,
  baseText: PLAIN,
  transcript: PLAIN,
  stars: 5,
  status: 'scored',
};

function storageKeys() {
  return Object.keys(localStorage).filter((k) => k.startsWith('shadowing.'));
}

function storedProgress() {
  return JSON.parse(localStorage.getItem(PROGRESS_KEY)!);
}

function storedAttempts() {
  return JSON.parse(localStorage.getItem(RECENT_ATTEMPTS_KEY)!);
}

beforeEach(() => {
  vi.restoreAllMocks();
  for (const key of storageKeys()) { localStorage.removeItem(key); }
});

describe('ProgressService', () => {
  it('records per-sentence progress, daily time and a bounded recent attempt', () => {
    const { progress } = setup();

    progress.startSession('speaking', null, 10);
    progress.record(scored);
    progress.endSession(60_000);

    const data = storedProgress();
    expect(data.sentences['sentence-uuid']).toMatchObject({
      bestStars: 5,
      lastStars: 5,
      streak: 1,
      mastered: false,
    });
    expect(data.days[localDay(new Date())].practisedMs).toBe(60_000);

    const attempts = storedAttempts();
    expect(attempts).toHaveLength(1);
    expect(attempts[0].sentenceId).toBe('sentence-uuid');
    expect(attempts[0].stars).toBe(5);
    expect(attempts[0].status).toBe('scored');
    expect(attempts[0].sessionId).toBeTruthy();
  });

  it('reuses one session across attempts', () => {
    const { progress } = setup();

    progress.startSession('speaking', null, 10);
    progress.record(scored);
    progress.record({ ...scored, stars: 3 });

    const attempts = storedAttempts();
    expect(attempts).toHaveLength(2);
    expect(attempts[0].sessionId).toBe(attempts[1].sessionId);
  });

  it('records a failed attempt with no stars', () => {
    const { progress } = setup();

    progress.startSession('speaking', null, 10);
    progress.record({ ...scored, stars: null, status: 'failed', transcript: '' });

    const attempts = storedAttempts();
    expect(attempts[0].status).toBe('failed');
    expect(attempts[0].stars).toBeNull();
    expect(storedProgress().days[localDay(new Date())]?.scoredAttempts ?? 0).toBe(0);
  });

  it('uses typing mode counts when typing', () => {
    const { progress } = setup();
    TestBed.inject(SettingsStore).setTypingMode(true);

    progress.startSession('speaking', null, 10);
    progress.record(scored);

    expect(storedAttempts()[0].mode).toBe('typing');
  });

  it('records nothing for a line not in the corpus', () => {
    const { progress } = setup(new Map());

    progress.startSession('speaking', null, 10);
    progress.record({ ...scored, line: 'Unknown line.' });

    expect(localStorage.getItem(RECENT_ATTEMPTS_KEY)).toBeNull();
    expect(localStorage.getItem(PROGRESS_KEY)).toBeNull();
  });

  it('does not write anything when a session was never opened', () => {
    const { progress } = setup();

    progress.endSession();

    expect(localStorage.getItem(PROGRESS_KEY)).toBeNull();
    expect(localStorage.getItem(RECENT_ATTEMPTS_KEY)).toBeNull();
  });

  it('starting a second activity closes the first session', () => {
    const { progress } = setup();

    progress.startSession('speaking', 'travel', 10);
    progress.record(scored);
    progress.startSession('dictation', 'travel', 5);
    progress.record({ ...scored, stars: 4 });

    const attempts = storedAttempts();
    expect(attempts).toHaveLength(2);
    expect(attempts[0].sessionId).not.toBe(attempts[1].sessionId);
  });

  it('records no practice time for a session that never played', () => {
    const { progress } = setup();

    progress.startSession('speaking', null, 10);
    progress.endSession();

    expect(localStorage.getItem(PROGRESS_KEY)).toBeNull();
  });

  it('never sends a negative practice time', () => {
    const { progress } = setup();

    progress.startSession('speaking', null, 10);
    progress.endSession(-5000);

    expect(localStorage.getItem(PROGRESS_KEY)).toBeNull();
  });

  it('refreshes sentence history after recording an attempt', () => {
    const { progress } = setup();
    const history = TestBed.inject(HistoryService);
    const refresh = vi.spyOn(history, 'refresh');

    progress.startSession('speaking', null, 10);
    progress.record(scored);

    expect(refresh).toHaveBeenCalledOnce();
  });

  it('shows a banner when progress cannot be written', () => {
    const storage = {
      read: () => null,
      write: () => false,
      remove: () => false,
    } as unknown as SafeStorage;
    const { progress } = setup(undefined, storage);

    progress.startSession('speaking', null, 10);
    progress.record(scored);

    expect(TestBed.inject(BannerStore).html()).toBe(MESSAGES.storageFull);
  });
});
