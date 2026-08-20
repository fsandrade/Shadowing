import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { SafeStorage } from '../platform/storage';
import { SETTINGS_KEY, SettingsStore } from './settings-store';

function setup(stored: unknown = null) {
  const write = vi.fn();
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [{
      provide: SafeStorage,
      useValue: { read: () => stored, write } as unknown as SafeStorage,
    }],
  });
  return { store: TestBed.inject(SettingsStore), write };
}

describe('SettingsStore defaults', () => {
  it('falls back to the vanilla defaults with nothing stored', () => {
    const { store } = setup(null);
    expect(store.levelId()).toBeNull();
    expect(store.topicId()).toBeNull();
    expect(store.source()).toBe('catalog');
    expect(store.rate()).toBe(1);
    expect(store.slack()).toBe(1);
    expect(store.voiceName()).toBe('');
    expect(store.durationMin()).toBe(0);
    expect(store.blur()).toBe(false);
    expect(store.sttEnabled()).toBe(false);
  });

  it('restores stored values', () => {
    const { store } = setup({
      levelId: 'B2', topicId: 'meetings', rate: 1.4, slack: 2, voiceName: 'David',
      durationMin: 10, blur: true, stt: true,
    });
    expect(store.levelId()).toBe('B2');
    expect(store.topicId()).toBe('meetings');
    expect(store.rate()).toBe(1.4);
    expect(store.slack()).toBe(2);
    expect(store.voiceName()).toBe('David');
    expect(store.durationMin()).toBe(10);
    expect(store.blur()).toBe(true);
    expect(store.sttEnabled()).toBe(true);
  });

  it('coerces a zero or unparseable rate to 1, matching Number(x) || 1', () => {
    expect(setup({ rate: 0 }).store.rate()).toBe(1);
    expect(setup({ rate: 'nope' }).store.rate()).toBe(1);
    expect(setup({ slack: 0 }).store.slack()).toBe(1);
  });

  it('treats blur and stt as strictly true, not truthy', () => {
    expect(setup({ blur: 'yes', stt: 1 }).store.blur()).toBe(false);
    expect(setup({ blur: 'yes', stt: 1 }).store.sttEnabled()).toBe(false);
  });

  it('coerces a missing or unparseable durationMin to 0', () => {
    expect(setup({ durationMin: 'nope' }).store.durationMin()).toBe(0);
    expect(setup({}).store.durationMin()).toBe(0);
  });
});

describe('SettingsStore persistence', () => {
  it('writes the legacy JSON shape, using the `stt` key', () => {
    const { store, write } = setup(null);
    store.setLevelId('A2');
    store.setTopicId('travel');
    store.setRate(1.6);
    store.setSttEnabled(true);
    TestBed.tick();

    const [key, payload] = write.mock.lastCall as [string, Record<string, unknown>];
    expect(key).toBe(SETTINGS_KEY);
    expect(payload).toEqual({
      levelId: 'A2', topicId: 'travel', source: 'catalog', rate: 1.6, slack: 1, voiceName: '',
      durationMin: 0, blur: false, stt: true, repeat: false, typing: false,
    });
  });

  it('exposes the storage key the vanilla app used', () => {
    expect(SETTINGS_KEY).toBe('shadowing.settings');
  });
});
