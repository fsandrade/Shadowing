import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppStartup } from './app-startup';
import { ProgressService, SENTENCE_IDS } from './data/progress-service';
import { MicrophoneService } from './platform/microphone';
import { Speaker } from './platform/speaker';
import { SafeStorage } from './platform/storage';
import { PlaybackService, type RepeatPolicy } from './playback/playback-service';
import { CATALOG } from './state/catalog-token';
import { PracticeStore } from './state/practice-store';
import { SettingsStore } from './state/settings-store';
import { ValidationService } from './validation/validation-service';
import { NO_SHUFFLE, TEST_CATALOG } from './testing/catalog';
import { RANDOM } from './platform/rng';

const DATA = TEST_CATALOG;

function setup(beforeRun?: (playback: PlaybackService) => void) {
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
  beforeRun?.(TestBed.inject(PlaybackService));
  TestBed.runInInjectionContext(() => startup.run());
  return {
    practice: TestBed.inject(PracticeStore),
    settings: TestBed.inject(SettingsStore),
    progress: TestBed.inject(ProgressService),
    validation: TestBed.inject(ValidationService),
    playback: TestBed.inject(PlaybackService),
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

describe('AppStartup repeat policy', () => {
  function capturePolicy() {
    let policy: RepeatPolicy | null = null;
    const deps = setup((playback) => {
      vi.spyOn(playback, 'setRepeatPolicy').mockImplementation((fn) => {
        policy = fn;
      });
    });
    return { ...deps, policy: () => policy };
  }

  it('does not repeat while scoring or Repeat is off', () => {
    const { policy, settings } = capturePolicy();
    expect(policy()).not.toBeNull();

    expect(policy()!(0, 0)).toBe(false);

    settings.setSttEnabled(true);
    expect(policy()!(0, 0)).toBe(false);

    settings.setRepeatUntilFive(true);
    expect(policy()!(0, 0)).toBe(true);
  });

  it('stops after five extra attempts', () => {
    const { policy, settings } = capturePolicy();
    settings.setSttEnabled(true);
    settings.setRepeatUntilFive(true);

    expect(policy()!(0, 4)).toBe(true);
    expect(policy()!(0, 5)).toBe(false);
  });

  it('repeats below five stars and stops at five', () => {
    const { policy, settings, validation } = capturePolicy();
    settings.setSttEnabled(true);
    settings.setRepeatUntilFive(true);

    validation.results.set(new Map([
      [0, { transcript: 'x', stars: 4, status: 'scored' }],
    ]));
    expect(policy()!(0, 0)).toBe(true);

    validation.results.set(new Map([
      [0, { transcript: 'x', stars: 5, status: 'scored' }],
    ]));
    expect(policy()!(0, 0)).toBe(false);

    validation.results.set(new Map([
      [0, { transcript: 'no speech', stars: null, status: 'failed' }],
    ]));
    expect(policy()!(0, 0)).toBe(true);
  });
});
