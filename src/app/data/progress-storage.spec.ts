import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { SafeStorage } from '../platform/storage';
import {
  LEGACY_SESSIONS_KEY,
  PROGRESS_KEY,
  ProgressStorage,
  RECENT_ATTEMPTS_KEY,
  RECENT_LIMIT,
} from './progress-storage';

interface Store {
  readonly map: Map<string, unknown>;
  readonly writes: Array<{ key: string; value: unknown }>;
  failKey?: string;
}

function setup(initial: Record<string, unknown> = {}, failKey?: string) {
  const map = new Map<string, unknown>(Object.entries(initial));
  const writes: Array<{ key: string; value: unknown }> = [];
  const storage: Store = { map, writes, failKey };

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [{
      provide: SafeStorage,
      useValue: {
        read: (key: string) => map.get(key) ?? null,
        write: (key: string, value: unknown) => {
          if (key === storage.failKey) { return false; }
          writes.push({ key, value });
          map.set(key, value);
          return true;
        },
        remove: (key: string) => {
          map.delete(key);
          return true;
        },
      } as unknown as SafeStorage,
    }],
  });

  return { store: TestBed.inject(ProgressStorage), storage, writes };
}

function attempt(
  sentenceId: string,
  stars: number | null,
  attemptedAt: string,
  status: 'scored' | 'failed' = stars === null ? 'failed' : 'scored',
): Record<string, unknown> {
  return {
    id: `attempt-${sentenceId}-${attemptedAt}`,
    sessionId: 'session-1',
    sentenceId,
    mode: 'speech',
    status,
    stars,
    transcript: '',
    targetWordCount: 1,
    matchedWordCount: 1,
    similarity: 1,
    attemptedAt,
  };
}

function record(
  store: ProgressStorage,
  sentenceId: string,
  stars: number | null,
  attemptedAt = new Date().toISOString(),
): boolean {
  return store.recordAttempt({
    sessionId: 'session-1',
    sentenceId,
    mode: 'speech',
    status: stars === null ? 'failed' : 'scored',
    stars,
    transcript: '',
    targetWordCount: 1,
    matchedWordCount: 1,
    similarity: 1,
    attemptedAt,
  });
}

beforeEach(() => TestBed.resetTestingModule());

describe('ProgressStorage', () => {
  it('stores per-sentence progress and per-day totals, not a growing attempt log', () => {
    const { store, storage } = setup();
    const at = '2026-11-24T09:00:00.000Z';

    expect(record(store, 's1', 3, at)).toBe(true);
    expect(record(store, 's1', 5, at)).toBe(true);
    expect(record(store, 's2', null, at)).toBe(true);

    const progress = store.read();
    expect(progress.sentences['s1']).toEqual({
      bestStars: 5,
      lastStars: 5,
      lastAttemptedAt: Date.parse(at),
    });
    expect(progress.sentences['s2']).toEqual({
      bestStars: 0,
      lastStars: 0,
      lastAttemptedAt: Date.parse(at),
    });
    expect(progress.days['2026-11-24']).toEqual({
      practisedMs: 0,
      scoredAttempts: 2,
      starsSum: 8,
      sentenceIds: ['s1'],
    });
    expect(storage.map.get(PROGRESS_KEY)).toBe(progress);
    expect((storage.map.get(RECENT_ATTEMPTS_KEY) as unknown[]).length).toBe(3);
  });

  it('keeps only the most recent attempts in the bounded log', () => {
    const { store, storage } = setup();

    for (let i = 0; i < RECENT_LIMIT + 5; i++) {
      record(store, `s${i}`, 5, new Date(2026, 0, 1, 0, 0, i).toISOString());
    }

    const recent = storage.map.get(RECENT_ATTEMPTS_KEY) as Array<{ sentenceId: string }>;
    expect(recent).toHaveLength(RECENT_LIMIT);
    expect(recent[0].sentenceId).toBe('s5');
    expect(recent.at(-1)?.sentenceId).toBe(`s${RECENT_LIMIT + 4}`);
  });

  it('adds practice time to the day the session started', () => {
    const { store } = setup();

    expect(store.addPractice(Date.parse('2026-11-24T23:30:00.000Z'), 90_000)).toBe(true);

    expect(store.read().days['2026-11-24'].practisedMs).toBe(90_000);
  });

  it('migrates legacy attempts and sessions, then bounds the old log', () => {
    const at = '2026-11-24T09:00:00.000Z';
    const legacyAttempts = [
      attempt('s1', 3, at),
      attempt('s1', 5, at),
      attempt('s2', null, at),
    ];
    const { store, storage } = setup({
      [RECENT_ATTEMPTS_KEY]: legacyAttempts,
      [LEGACY_SESSIONS_KEY]: [{
        id: 'session-1',
        startedAt: at,
        practisedMs: 120_000,
      }],
    });

    const progress = store.read();

    expect(progress.sentences['s1'].bestStars).toBe(5);
    expect(progress.days['2026-11-24']).toMatchObject({
      practisedMs: 120_000,
      scoredAttempts: 2,
      starsSum: 8,
    });
    expect((storage.map.get(RECENT_ATTEMPTS_KEY) as unknown[]).length).toBe(3);
    expect(storage.map.has(LEGACY_SESSIONS_KEY)).toBe(false);
  });

  it('still returns migrated data when the compact write fails', () => {
    const at = '2026-11-24T09:00:00.000Z';
    const { store, storage } = setup({
      [RECENT_ATTEMPTS_KEY]: [attempt('s1', 5, at)],
      [LEGACY_SESSIONS_KEY]: [{ id: 's', startedAt: at, practisedMs: 60_000 }],
    }, PROGRESS_KEY);

    expect(store.read().sentences['s1'].bestStars).toBe(5);
    expect(storage.map.has(LEGACY_SESSIONS_KEY)).toBe(true);
  });

  it('reports a failed write instead of throwing or pretending it saved', () => {
    const { store } = setup({}, PROGRESS_KEY);

    expect(record(store, 's1', 5)).toBe(false);
    expect(() => record(store, 's1', 5)).not.toThrow();
  });
});
