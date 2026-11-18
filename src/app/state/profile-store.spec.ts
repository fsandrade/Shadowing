import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { SafeStorage } from '../platform/storage';
import { SETTINGS_KEY } from './settings-store';
import { PROFILE_KEY, ProfileStore } from './profile-store';

function setup(opts: { stored?: Record<string, unknown> } = {}) {
  const written = new Map<string, unknown>();

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      {
        provide: SafeStorage,
        useValue: {
          read: (key: string) => written.has(key) ? written.get(key) : (opts.stored?.[key] ?? null),
          write: (key: string, value: unknown) => { written.set(key, value); },
        } as unknown as SafeStorage,
      },
    ],
  });

  return { store: TestBed.inject(ProfileStore), written };
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
  it('caches the choice locally (no server to push to)', () => {
    const { store, written } = setup();
    store.setLevel('A2');

    expect(store.levelId()).toBe('A2');
    expect(written.get(PROFILE_KEY)).toEqual({ levelId: 'A2' });
  });

  it('still remembers the choice locally', () => {
    const { store, written } = setup();
    store.setLevel('A2');
    expect(written.get(PROFILE_KEY)).toEqual({ levelId: 'A2' });
  });

  it('forgets a level', () => {
    const { store, written } = setup({ stored: { [PROFILE_KEY]: { levelId: 'B1' } } });
    store.clear();
    expect(store.levelId()).toBeNull();
    expect(store.chosen()).toBe(false);
    expect(written.get(PROFILE_KEY)).toEqual({ levelId: null });
  });
});

describe('ProfileStore syncing', () => {
  it('load() is a local no-op (no server to sync with)', async () => {
    const { store } = setup({ stored: { [PROFILE_KEY]: { levelId: 'B2' } } });
    await store.load();
    expect(store.levelId()).toBe('B2');
  });
});
