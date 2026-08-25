import { TestBed } from '@angular/core/testing';
import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { INITIAL_USER } from '../platform/auth';
import { SafeStorage } from '../platform/storage';
import { SUPABASE } from '../platform/supabase-client';
import { SETTINGS_KEY, SettingsStore } from '../state/settings-store';
import { AttemptQueue, QUEUE_KEY } from './attempt-queue';
import { type Attempt, ProgressService, SENTENCE_IDS } from './progress-service';

const USER = '11111111-1111-4111-8111-111111111111';

function user(id: string | null) {
  return id === null ? null : { id, is_anonymous: true, user_metadata: {} };
}
const LINE = 'I must\'ve <b>hit the snooze button</b> like four times this morning.';
const PLAIN = 'I must\'ve hit the snooze button like four times this morning.';

interface Sent { table: string; op: 'insert' | 'update'; row: Record<string, unknown>; }

function fakeClient(reply: (table: string) => { status: number; message?: string }) {
  const sent: Sent[] = [];
  const result = (table: string) => {
    const r = reply(table);
    return r.status < 400
      ? { error: null, status: r.status }
      : { error: { message: r.message ?? 'nope' }, status: r.status };
  };
  const client = {
    from: (table: string) => ({
      insert: (row: Record<string, unknown>) => {
        sent.push({ table, op: 'insert', row });
        return Promise.resolve(result(table));
      },
      update: (row: Record<string, unknown>) => ({
        eq: () => {
          sent.push({ table, op: 'update', row });
          return Promise.resolve(result(table));
        },
      }),
    }),
    auth: { onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) },
  } as unknown as SupabaseClient;
  return { client, sent };
}

function setup(
  reply: (table: string) => { status: number; message?: string } = () => ({ status: 201 }),
  opts: { userId?: string | null; stored?: Record<string, unknown> } = {},
) {
  const store = new Map<string, unknown>();
  const { client, sent } = fakeClient(reply);

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: SUPABASE, useValue: client },
      { provide: INITIAL_USER, useValue: user(opts.userId === undefined ? USER : opts.userId) },
      { provide: SENTENCE_IDS, useValue: new Map([[LINE, 'sentence-uuid']]) },
      {
        provide: SafeStorage,
        useValue: {
          read: (key: string) => (key === SETTINGS_KEY ? (opts.stored ?? {}) : store.get(key) ?? null),
          write: (key: string, value: unknown) => { store.set(key, value); },
        } as unknown as SafeStorage,
      },
    ],
  });

  return {
    progress: TestBed.inject(ProgressService),
    queue: TestBed.inject(AttemptQueue),
    settings: TestBed.inject(SettingsStore),
    sent,
    store,
  };
}

const scored: Attempt = {
  line: LINE,
  baseText: PLAIN,
  transcript: PLAIN,
  stars: 5,
  status: 'scored',
};

beforeEach(() => { vi.restoreAllMocks(); });

describe('ProgressService', () => {
  it('records the full attempt detail against the session that is already open', async () => {
    const { progress, sent } = setup();

    progress.startSession('speaking', null, 10);
    progress.record(scored);
    await vi.waitFor(() => expect(sent).toHaveLength(2));

    expect(sent[0].table).toBe('practice_sessions');
    expect(sent[1].table).toBe('sentence_attempts');
    expect(sent[1].row['sentence_id']).toBe('sentence-uuid');
    expect(sent[1].row['user_id']).toBe(USER);
    expect(sent[1].row['stars']).toBe(5);
    expect(sent[1].row['status']).toBe('scored');
    expect(sent[1].row['session_id']).toBe(sent[0].row['id']);
  });

  it('reuses one session across attempts', async () => {
    const { progress, sent } = setup();

    progress.startSession('speaking', null, 10);
    progress.record(scored);
    await vi.waitFor(() => expect(sent).toHaveLength(2));
    progress.record({ ...scored, stars: 3 });
    await vi.waitFor(() => expect(sent).toHaveLength(3));

    expect(sent.filter((s) => s.table === 'practice_sessions')).toHaveLength(1);
  });

  it('records the counts the score was actually derived from', async () => {
    const { progress, sent } = setup();

    progress.startSession('speaking', null, 10);
    progress.record({ ...scored, transcript: "I must've hit the snooze" });
    await vi.waitFor(() => expect(sent).toHaveLength(2));

    const row = sent[1].row;

    expect(row['target_word_count']).toBe(11);
    expect(row['matched_word_count']).toBe(5);
    expect(row['similarity']).toBeCloseTo(0.625, 3);
  });

  it('records a failed attempt with no stars', async () => {
    const { progress, sent } = setup();

    progress.startSession('speaking', null, 10);
    progress.record({ ...scored, stars: null, status: 'failed', transcript: '' });
    await vi.waitFor(() => expect(sent).toHaveLength(2));

    expect(sent[1].row['status']).toBe('failed');
    expect(sent[1].row['stars']).toBeNull();
  });

  it('uses typing mode counts when typing', async () => {
    const { progress, settings, sent } = setup();
    settings.setTypingMode(true);

    progress.startSession('speaking', null, 10);
    progress.record(scored);
    await vi.waitFor(() => expect(sent).toHaveLength(2));

    expect(sent[1].row['mode']).toBe('typing');
  });

  it('ignores practice on text that is not in the corpus', async () => {
    const { progress, sent } = setup();

    progress.startSession('speaking', null, 10);
    progress.record({ ...scored, line: 'Something the learner pasted in.' });
    await vi.waitFor(() => expect(sent).toHaveLength(1));

    // Only the session was written; the unrecognised line produced no attempt.
    expect(sent[0].table).toBe('practice_sessions');
  });

  it('records nothing at all when there is no signed-in user', async () => {
    const { progress, sent } = setup(() => ({ status: 201 }), { userId: null });

    progress.record(scored);
    await new Promise((r) => setTimeout(r, 0));

    expect(sent).toHaveLength(0);
  });

  it('closes the session with an elapsed time', async () => {
    const { progress, sent } = setup();

    progress.startSession('speaking', null, 10);
    progress.record(scored);
    await vi.waitFor(() => expect(sent).toHaveLength(2));
    progress.endSession();
    await vi.waitFor(() => expect(sent).toHaveLength(3));

    expect(sent[2].op).toBe('update');
    expect(sent[2].table).toBe('practice_sessions');
    expect(sent[2].row['ended_at']).toBeTruthy();
    expect(sent[2].row['elapsed_ms']).toBeGreaterThanOrEqual(0);
  });

  it('does not close a session that was never opened', async () => {
    const { progress, sent } = setup();
    progress.endSession();
    await new Promise((r) => setTimeout(r, 0));
    expect(sent).toHaveLength(0);
  });
});

describe('ProgressService when the network is down', () => {
  it('keeps failed writes and replays them later', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const offline = setup(() => ({ status: 503, message: 'service unavailable' }));

    offline.progress.startSession('speaking', null, 10);
    offline.progress.record(scored);
    await vi.waitFor(() => expect(offline.sent.length).toBeGreaterThan(0));

    const held = offline.store.get(QUEUE_KEY) as unknown[];
    expect(held).toHaveLength(2);
    expect((held[0] as { kind: string }).kind).toBe('session');
    expect((held[1] as { kind: string }).kind).toBe('attempt');
  });

  it('stops at the first failure so a session is never skipped', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { progress, sent, store } = setup((table) =>
      table === 'practice_sessions' ? { status: 503 } : { status: 201 });

    progress.startSession('speaking', null, 10);
    progress.record(scored);
    await vi.waitFor(() => expect(sent.length).toBeGreaterThan(0));

    expect(sent.every((s) => s.table === 'practice_sessions')).toBe(true);
    expect(store.get(QUEUE_KEY)).toHaveLength(2);
  });

  it('drops a write the server will never accept, rather than wedging the queue', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { progress, sent, store } = setup(() => ({ status: 400, message: 'malformed' }));

    progress.startSession('speaking', null, 10);
    progress.record(scored);
    await vi.waitFor(() => expect(sent).toHaveLength(2));

    expect(store.get(QUEUE_KEY)).toEqual([]);
    expect(warn).toHaveBeenCalled();
  });

  it('treats a duplicate as already recorded and moves on', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { progress, sent, store } = setup(() => ({ status: 409, message: 'duplicate key' }));

    progress.startSession('speaking', null, 10);
    progress.record(scored);
    await vi.waitFor(() => expect(sent).toHaveLength(2));

    expect(store.get(QUEUE_KEY)).toEqual([]);
  });

  it('retries a rate-limited write rather than discarding it', async () => {
    const { progress, sent, store } = setup(() => ({ status: 429 }));

    progress.startSession('speaking', null, 10);
    progress.record(scored);
    await vi.waitFor(() => expect(sent.length).toBeGreaterThan(0));

    expect(store.get(QUEUE_KEY)).toHaveLength(2);
  });

  it('flushes what an earlier visit left behind', async () => {
    const pending = [
      { kind: 'attempt', userId: USER, row: { id: 'a1', user_id: USER } },
      { kind: 'attempt', userId: USER, row: { id: 'a2', user_id: USER } },
    ];
    const store = new Map<string, unknown>([[QUEUE_KEY, pending]]);
    const { client, sent } = fakeClient(() => ({ status: 201 }));

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: SUPABASE, useValue: client },
        { provide: INITIAL_USER, useValue: user(USER) },
        { provide: SENTENCE_IDS, useValue: new Map() },
        {
          provide: SafeStorage,
          useValue: {
            read: (key: string) => (key === SETTINGS_KEY ? {} : store.get(key) ?? null),
            write: (key: string, value: unknown) => { store.set(key, value); },
          } as unknown as SafeStorage,
        },
      ],
    });

    TestBed.inject(ProgressService).flush();
    await vi.waitFor(() => expect(sent).toHaveLength(2));
    expect(store.get(QUEUE_KEY)).toEqual([]);
  });

  it('discards progress belonging to a different user', async () => {
    const pending = [
      { kind: 'attempt', userId: 'someone-else', row: { id: 'a1' } },
      { kind: 'attempt', userId: USER, row: { id: 'a2' } },
    ];
    const store = new Map<string, unknown>([[QUEUE_KEY, pending]]);
    const { client, sent } = fakeClient(() => ({ status: 201 }));

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: SUPABASE, useValue: client },
        { provide: INITIAL_USER, useValue: user(USER) },
        { provide: SENTENCE_IDS, useValue: new Map() },
        {
          provide: SafeStorage,
          useValue: {
            read: (key: string) => (key === SETTINGS_KEY ? {} : store.get(key) ?? null),
            write: (key: string, value: unknown) => { store.set(key, value); },
          } as unknown as SafeStorage,
        },
      ],
    });

    TestBed.inject(ProgressService).flush();
    await vi.waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0].row['id']).toBe('a2');
  });
});

describe('ProgressService session lifecycle', () => {
  it('opens a session for an unscored activity, with no attempt in sight', async () => {
    const { progress, sent } = setup();

    progress.startSession('listening', 'travel', 10);
    await vi.waitFor(() => expect(sent).toHaveLength(1));

    expect(sent[0].table).toBe('practice_sessions');
    expect(sent[0].row['activity']).toBe('listening');
    expect(sent[0].row['deck_id']).toBe('travel');
    expect(sent[0].row['planned_duration_min']).toBe(10);
    expect(sent[0].row).not.toHaveProperty('mode');
  });

  it('files an attempt against the session that is already open', async () => {
    const { progress, sent } = setup();

    progress.startSession('speaking', 'travel', 10);
    progress.record(scored);
    await vi.waitFor(() => expect(sent).toHaveLength(2));

    expect(sent[1].table).toBe('sentence_attempts');
    expect(sent[1].row['session_id']).toBe(sent[0].row['id']);
  });

  it('drops an attempt that arrives with no session open', async () => {
    const { progress, sent } = setup();

    progress.record(scored);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(sent).toEqual([]);
  });

  it('starting a second activity closes the first session', async () => {
    const { progress, sent } = setup();

    progress.startSession('listening', 'travel', 10);
    progress.startSession('shadowing', 'travel', 5);
    await vi.waitFor(() => expect(sent).toHaveLength(3));

    expect(sent.map((s) => s.op)).toEqual(['insert', 'update', 'insert']);
    expect(sent[0].row['activity']).toBe('listening');
    expect(sent[1].row).toHaveProperty('ended_at');
    expect(sent[2].row['activity']).toBe('shadowing');
  });

  it('records the topic as null when the learner picked every topic', async () => {
    const { progress, sent } = setup();

    progress.startSession('listening', null, 15);
    await vi.waitFor(() => expect(sent).toHaveLength(1));

    expect(sent[0].row['deck_id']).toBeNull();
  });
});

describe('AttemptQueue', () => {
  it('ignores junk left in storage', () => {
    const store = new Map<string, unknown>([[QUEUE_KEY, [null, 'nonsense', { kind: 'attempt' }]]]);
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [{
        provide: SafeStorage,
        useValue: {
          read: (key: string) => store.get(key) ?? null,
          write: (key: string, value: unknown) => { store.set(key, value); },
        } as unknown as SafeStorage,
      }],
    });

    expect(TestBed.inject(AttemptQueue).read()).toEqual([]);
  });

  it('caps how much it will hold, keeping the most recent', () => {
    const store = new Map<string, unknown>();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [{
        provide: SafeStorage,
        useValue: {
          read: (key: string) => store.get(key) ?? null,
          write: (key: string, value: unknown) => { store.set(key, value); },
        } as unknown as SafeStorage,
      }],
    });

    const queue = TestBed.inject(AttemptQueue);
    queue.write(Array.from({ length: 600 }, (_, i) => ({
      kind: 'attempt' as const, userId: USER, row: { id: `a${i}` },
    })));

    const held = queue.read();
    expect(held).toHaveLength(500);
    expect(held[0].row['id']).toBe('a100');
    expect(held[499].row['id']).toBe('a599');
  });
});

describe('ProgressService recording practice time', () => {
  it('sends the time actually practised alongside the wall clock', async () => {
    const { progress, sent } = setup();

    progress.startSession('listening', null, 10);
    progress.endSession(90_000);
    await vi.waitFor(() => expect(sent).toHaveLength(2));

    const close = sent[1];
    expect(close.op).toBe('update');
    expect(close.row['practised_ms']).toBe(90_000);
    // Wall clock stays: the gap between the two is what marks an abandoned
    // session, so neither number replaces the other.
    expect(close.row).toHaveProperty('elapsed_ms');
  });

  it('records no practice time for a session that never played', async () => {
    const { progress, sent } = setup();

    progress.startSession('listening', null, 10);
    progress.endSession();
    await vi.waitFor(() => expect(sent).toHaveLength(2));

    expect(sent[1].row['practised_ms']).toBe(0);
  });

  it('never sends a negative practice time', async () => {
    const { progress, sent } = setup();

    progress.startSession('listening', null, 10);
    progress.endSession(-5000);
    await vi.waitFor(() => expect(sent).toHaveLength(2));

    expect(sent[1].row['practised_ms']).toBe(0);
  });
});
