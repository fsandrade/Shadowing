import { TestBed } from '@angular/core/testing';
import type { SupabaseClient } from '@supabase/supabase-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppStartup } from './app-startup';
import { SENTENCE_IDS } from './data/progress-service';
import { INITIAL_USER } from './platform/auth';
import { SUPABASE } from './platform/supabase-client';
import { MicrophoneService } from './platform/microphone';
import { Speaker } from './platform/speaker';
import { SafeStorage } from './platform/storage';
import { CATALOG } from './state/catalog-token';
import { ProfileStore } from './state/profile-store';
import { SETTINGS_KEY } from './state/settings-store';
import { NO_SHUFFLE, TEST_CATALOG } from './testing/catalog';
import { RANDOM } from './platform/rng';

const DATA = TEST_CATALOG;

function setup(storedLevelId: string | null) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: CATALOG, useValue: DATA },
      { provide: RANDOM, useValue: NO_SHUFFLE },
      { provide: SENTENCE_IDS, useValue: new Map<string, string>() },
      { provide: INITIAL_USER, useValue: null },
      {
        provide: SUPABASE,
        useValue: {
          auth: { onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) },
          from: () => { throw new Error('no writes expected in startup tests'); },
        } as unknown as SupabaseClient,
      },
      {
        provide: SafeStorage,
        useValue: {
          read: (key: string) => (key === SETTINGS_KEY ? { levelId: storedLevelId } : null),
          write: () => {},
        } as unknown as SafeStorage,
      },
      {
        provide: Speaker,
        useValue: {
          supported: true,
          voices: () => [{ name: 'David', lang: 'en-US' }] as SpeechSynthesisVoice[],
          onVoicesChanged: () => {},
          speak: () => Promise.resolve(),
          cancel: () => {},
          keepAlive: () => {},
        } as unknown as Speaker,
      },
      {
        provide: MicrophoneService,
        useValue: {
          denied: () => false,
          ensure: () => Promise.resolve({}),
          markDenied() {},
          release() {},
        } as unknown as MicrophoneService,
      },
    ],
  });
  const startup = TestBed.inject(AppStartup);
  TestBed.runInInjectionContext(() => startup.run());
  return { profile: TestBed.inject(ProfileStore) };
}

describe('AppStartup level recovery', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('keeps a remembered level that still has sentences', () => {
    expect(setup('A2').profile.levelId()).toBe('A2');
  });

  it('forgets a level that no longer exists at all', () => {
    expect(setup('Z9').profile.levelId()).toBeNull();
  });

  it('forgets a level that exists but has been emptied', () => {
    expect(setup('C2').profile.levelId()).toBeNull();
  });

  it('leaves a first-time visitor at the picker', () => {
    expect(setup(null).profile.levelId()).toBeNull();
  });
});
