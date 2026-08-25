import { TestBed } from '@angular/core/testing';
import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { INITIAL_USER } from '../platform/auth';
import { SafeStorage } from '../platform/storage';
import { SUPABASE } from '../platform/supabase-client';
import { SETTINGS_KEY } from './settings-store';
import { PROFILE_KEY, ProfileStore } from './profile-store';

const USER = '11111111-1111-4111-8111-111111111111';

function setup(opts: {
  stored?: Record<string, unknown>;
  remoteLevel?: string | null;
  remoteFails?: boolean;
  userId?: string | null;
} = {}) {
  const written = new Map<string, unknown>();
  const upserts: Array<Record<string, unknown>> = [];

  const client = {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () => Promise.resolve(
            opts.remoteFails
              ? { data: null, error: { message: 'nope' } }
              : { data: { level_id: opts.remoteLevel ?? null }, error: null },
          ),
        }),
      }),
      upsert: (row: Record<string, unknown>) => {
        upserts.push(row);
        return Promise.resolve({ error: null });
      },
    }),
    auth: { onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) },
  } as unknown as SupabaseClient;

  const userId = opts.userId === undefined ? USER : opts.userId;

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: SUPABASE, useValue: client },
      {
        provide: INITIAL_USER,
        useValue: userId === null ? null : { id: userId, is_anonymous: true, user_metadata: {} },
      },
      {
        provide: SafeStorage,
        useValue: {
          read: (key: string) =>
            written.has(key) ? written.get(key) : (opts.stored?.[key] ?? null),
          write: (key: string, value: unknown) => { written.set(key, value); },
        } as unknown as SafeStorage,
      },
    ],
  });

  return { store: TestBed.inject(ProfileStore), written, upserts };
}

describe('ProfileStore first run', () => {
  it('has no level and asks for one', () => {
    const { store } = setup();
    expect(store.levelId()).toBeNull();
    expect(store.chosen()).toBe(false);
  });

  it('adopts the level the old settings blob already holds', () => {
    const { store } = setup({ stored: { [SETTINGS_KEY]: { levelId: 'B1' } } });
    expect(store.levelId()).toBe('B1');
    expect(store.chosen()).toBe(true);
  });

  it('rewrites an adopted level into the profile immediately, so losing the settings blob cannot lose it', () => {
    const { store, written } = setup({ stored: { [SETTINGS_KEY]: { levelId: 'B1' } } });
    expect(store.levelId()).toBe('B1');
    expect(written.get(PROFILE_KEY)).toEqual({ levelId: 'B1' });
  });

  it('prefers its own cache over the old settings blob', () => {
    const { store } = setup({
      stored: { [PROFILE_KEY]: { levelId: 'C1' }, [SETTINGS_KEY]: { levelId: 'B1' } },
    });
    expect(store.levelId()).toBe('C1');
  });

  it('ignores a stored level that is not a non-empty string', () => {
    expect(setup({ stored: { [PROFILE_KEY]: { levelId: '' } } }).store.levelId()).toBeNull();
    expect(setup({ stored: { [PROFILE_KEY]: { levelId: 7 } } }).store.levelId()).toBeNull();
  });
});

describe('ProfileStore choosing a level', () => {
  it('caches the choice and pushes it to the server', async () => {
    const { store, written, upserts } = setup();
    store.setLevel('A2');

    expect(store.levelId()).toBe('A2');
    expect(written.get(PROFILE_KEY)).toEqual({ levelId: 'A2' });

    await vi.waitFor(() => expect(upserts).toHaveLength(1));
    expect(upserts[0]).toEqual({ user_id: USER, level_id: 'A2' });
  });

  it('still remembers the choice locally with nobody signed in', async () => {
    const { store, written, upserts } = setup({ userId: null });
    store.setLevel('A2');
    expect(written.get(PROFILE_KEY)).toEqual({ levelId: 'A2' });
    expect(upserts).toEqual([]);
  });

  it('forgets a level that no longer exists', () => {
    const { store, written } = setup({ stored: { [PROFILE_KEY]: { levelId: 'B1' } } });
    store.clear();
    expect(store.levelId()).toBeNull();
    expect(store.chosen()).toBe(false);
    expect(written.get(PROFILE_KEY)).toEqual({ levelId: null });
  });
});

describe('ProfileStore syncing', () => {
  it('takes the server level when there is one', async () => {
    const { store, written } = setup({ remoteLevel: 'C1' });
    await store.load();
    expect(store.levelId()).toBe('C1');
    expect(written.get(PROFILE_KEY)).toEqual({ levelId: 'C1' });
  });

  it('pushes the local level up when the server has none yet', async () => {
    const { store, upserts } = setup({
      stored: { [PROFILE_KEY]: { levelId: 'B2' } },
      remoteLevel: null,
    });
    await store.load();
    await vi.waitFor(() => expect(upserts).toHaveLength(1));
    expect(upserts[0]).toEqual({ user_id: USER, level_id: 'B2' });
  });

  it('keeps the cached level when the read fails', async () => {
    const { store } = setup({ stored: { [PROFILE_KEY]: { levelId: 'B2' } }, remoteFails: true });
    await store.load();
    expect(store.levelId()).toBe('B2');
  });

  it('does nothing at all with nobody signed in', async () => {
    const { store, upserts } = setup({ userId: null, remoteLevel: 'C1' });
    await store.load();
    expect(store.levelId()).toBeNull();
    expect(upserts).toEqual([]);
  });
});
