import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppStartup } from './app-startup';
import { ProgressService, SENTENCE_IDS } from './data/progress-service';
import { MicrophoneService } from './platform/microphone';
import { Speaker } from './platform/speaker';
import { SafeStorage } from './platform/storage';
import { CATALOG } from './state/catalog-token';
import { PracticeStore } from './state/practice-store';
import { SettingsStore } from './state/settings-store';
import { NO_SHUFFLE, TEST_CATALOG } from './testing/catalog';
import { RANDOM } from './platform/rng';

const DATA = TEST_CATALOG;

function setup() {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: CATALOG, useValue: DATA },
      { provide: RANDOM, useValue: NO_SHUFFLE },
      { provide: SENTENCE_IDS, useValue: new Map<string, string>() },
      {
        provide: SafeStorage,
        useValue: {
          read: () => null,
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
  return {
    practice: TestBed.inject(PracticeStore),
    settings: TestBed.inject(SettingsStore),
    progress: TestBed.inject(ProgressService),
  };
}

describe('AppStartup', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('does not end a session behind the flow store\'s back when the duration changes', async () => {
    const { settings, progress } = setup();
    const ended = vi.spyOn(progress, 'endSession');

    settings.setDurationMin(15);
    TestBed.tick();
    await Promise.resolve();

    expect(ended).not.toHaveBeenCalled();
  });
});
