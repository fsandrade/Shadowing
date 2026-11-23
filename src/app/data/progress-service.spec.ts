import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsStore } from '../state/settings-store';
import { HistoryService } from './history-service';
import { SENTENCE_IDS, type Attempt, ProgressService } from './progress-service';

const LINE = 'I must\'ve <b>hit the snooze button</b> like four times this morning.';
const PLAIN = 'I must\'ve hit the snooze button like four times this morning.';

function setup(sentenceIds: Map<string, string> = new Map([[LINE, 'sentence-uuid']])) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [{ provide: SENTENCE_IDS, useValue: sentenceIds }],
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

beforeEach(() => {
  vi.restoreAllMocks();
  for (const key of storageKeys()) { localStorage.removeItem(key); }
});

describe('ProgressService', () => {
  it('records a session and an attempt to localStorage', async () => {
    const { progress } = setup();

    progress.startSession('speaking', null, 10);
    progress.record(scored);
    progress.endSession();

    const sessions = JSON.parse(localStorage.getItem('shadowing.sessions')!);
    const attempts = JSON.parse(localStorage.getItem('shadowing.attempts')!);

    expect(sessions).toHaveLength(1);
    expect(sessions[0].activity).toBe('speaking');
    expect(sessions[0].deckId).toBeNull();
    expect(sessions[0].plannedDurationMin).toBe(10);
    expect(sessions[0].endedAt).toBeTruthy();
    expect(sessions[0].elapsedMs).toBeGreaterThanOrEqual(0);

    expect(attempts).toHaveLength(1);
    expect(attempts[0].sessionId).toBe(sessions[0].id);
    expect(attempts[0].sentenceId).toBe('sentence-uuid');
    expect(attempts[0].stars).toBe(5);
    expect(attempts[0].status).toBe('scored');
  });

  it('reuses one session across attempts', async () => {
    const { progress } = setup();

    progress.startSession('speaking', null, 10);
    progress.record(scored);
    progress.record({ ...scored, stars: 3 });

    const sessions = JSON.parse(localStorage.getItem('shadowing.sessions')!);
    const attempts = JSON.parse(localStorage.getItem('shadowing.attempts')!);

    expect(sessions).toHaveLength(1);
    expect(attempts).toHaveLength(2);
    expect(attempts.every((a: { sessionId: string }) => a.sessionId === sessions[0].id)).toBe(true);
  });

  it('records a failed attempt with no stars', async () => {
    const { progress } = setup();

    progress.startSession('speaking', null, 10);
    progress.record({ ...scored, stars: null, status: 'failed', transcript: '' });

    const attempts = JSON.parse(localStorage.getItem('shadowing.attempts')!);
    expect(attempts[0].status).toBe('failed');
    expect(attempts[0].stars).toBeNull();
  });

  it('uses typing mode counts when typing', async () => {
    const { progress } = setup();
    TestBed.inject(SettingsStore).setTypingMode(true);

    progress.startSession('speaking', null, 10);
    progress.record(scored);

    const attempts = JSON.parse(localStorage.getItem('shadowing.attempts')!);
    expect(attempts[0].mode).toBe('typing');
  });

  it('records nothing for a line not in the corpus', async () => {
    const { progress } = setup(new Map());

    progress.startSession('speaking', null, 10);
    progress.record({ ...scored, line: 'Unknown line.' });

    const attemptsRaw = localStorage.getItem('shadowing.attempts');
    const attempts = attemptsRaw ? JSON.parse(attemptsRaw) : [];
    expect(attempts).toHaveLength(0);
  });

  it('does not close a session that was never opened', async () => {
    const { progress } = setup();

    progress.endSession();

    expect(localStorage.getItem('shadowing.sessions')).toBeNull();
  });

  it('starting a second activity closes the first session', async () => {
    const { progress } = setup();

    progress.startSession('speaking', 'travel', 10);
    progress.startSession('dictation', 'travel', 5);

    const sessions = JSON.parse(localStorage.getItem('shadowing.sessions')!);
    expect(sessions).toHaveLength(2);
    expect(sessions[0].endedAt).toBeTruthy();
    expect(sessions[0].activity).toBe('speaking');
    expect(sessions[1].activity).toBe('dictation');
    expect(sessions[1].endedAt).toBeNull();
  });

  it('records no practice time for a session that never played', async () => {
    const { progress } = setup();

    progress.startSession('speaking', null, 10);
    progress.endSession();

    const sessions = JSON.parse(localStorage.getItem('shadowing.sessions')!);
    expect(sessions[0].practisedMs).toBe(0);
  });

  it('never sends a negative practice time', async () => {
    const { progress } = setup();

    progress.startSession('speaking', null, 10);
    progress.endSession(-5000);

    const sessions = JSON.parse(localStorage.getItem('shadowing.sessions')!);
    expect(sessions[0].practisedMs).toBe(0);
  });

  it('flush is a no-op since localStorage writes are synchronous', () => {
    const { progress } = setup();
    expect(() => progress.flush()).not.toThrow();
  });

  it('refreshes sentence history after recording an attempt', () => {
    const { progress } = setup();
    const history = TestBed.inject(HistoryService);
    const refresh = vi.spyOn(history, 'refresh');

    progress.startSession('speaking', null, 10);
    progress.record(scored);

    expect(refresh).toHaveBeenCalledOnce();
  });
});
