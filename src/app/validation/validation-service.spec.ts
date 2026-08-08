import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { MicrophoneService } from '../platform/microphone';
import {
  type RecognitionOptions, type RecognitionSession, SpeechRecognizer,
} from '../platform/speech-recognition';
import { SafeStorage } from '../platform/storage';
import { BannerStore } from '../state/banner-store';
import { MESSAGES } from '../state/messages';
import { SettingsStore } from '../state/settings-store';
import { ValidationService } from './validation-service';

/** Captures the callbacks so a test can drive recognition by hand. */
function fakeRecognizer() {
  let opts: RecognitionOptions = {};
  const session = {
    started: false,
    aborted: false,
    start() { this.started = true; },
    stop() {},
    abort() { this.aborted = true; },
  };
  return {
    session,
    opts: () => opts,
    impl: {
      supported: () => true,
      recognize: (o: RecognitionOptions) => {
        opts = o;
        return session as unknown as RecognitionSession;
      },
    } as unknown as SpeechRecognizer,
  };
}

function setup(options: { denied?: boolean } = {}) {
  const rec = fakeRecognizer();
  const mic = {
    denied: () => options.denied ?? false,
    ensure: vi.fn().mockResolvedValue({}),
    markDenied: vi.fn(),
    release: vi.fn(),
  };
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      {
        provide: SafeStorage,
        useValue: { read: () => null, write: () => {} } as unknown as SafeStorage,
      },
      { provide: SpeechRecognizer, useValue: rec.impl },
      { provide: MicrophoneService, useValue: mic as unknown as MicrophoneService },
    ],
  });
  return {
    rec,
    mic,
    validation: TestBed.inject(ValidationService),
    banner: TestBed.inject(BannerStore),
    settings: TestBed.inject(SettingsStore),
  };
}

describe('ValidationService session', () => {
  it('opens a listening box for the given line', () => {
    const { validation, rec } = setup();
    validation.begin(2, 'hit the road');

    expect(validation.active()).toBe(true);
    expect(validation.lineIndex()).toBe(2);
    expect(validation.transcript()).toBe(MESSAGES.listening);
    expect(validation.stars()).toBeNull();
    expect(rec.session.started).toBe(true);
    expect(rec.opts().lang).toBe('en-US');
  });

  it('shows interim text as it arrives', () => {
    const { validation, rec } = setup();
    validation.begin(0, 'hit the road');
    rec.opts().onInterim?.('hit the');
    expect(validation.transcript()).toBe('hit the');
  });

  it('rates a good repeat and resolves the wait', async () => {
    const { validation, rec } = setup();
    let settled = false;
    void validation.begin(0, 'hit the road')!.then(() => { settled = true; });

    rec.opts().onResult?.('hit the road');
    await Promise.resolve();

    expect(validation.transcript()).toBe('hit the road');
    expect(validation.stars()).toBe(5);
    expect(settled).toBe(true);
  });

  it('reports silence without stars', async () => {
    const { validation, rec } = setup();
    void validation.begin(0, 'hit the road');
    rec.opts().onResult?.('');
    await Promise.resolve();

    expect(validation.transcript()).toBe(MESSAGES.noSpeechDetected);
    expect(validation.stars()).toBeNull();
  });

  it('returns null instead of a session once the mic is denied', () => {
    const { validation } = setup({ denied: true });
    expect(validation.begin(0, 'hit the road')).toBeNull();
    expect(validation.active()).toBe(false);
  });
});

describe('ValidationService error handling', () => {
  it('ignores an aborted error, since that is our own cancellation', () => {
    const { validation, rec } = setup();
    void validation.begin(0, 'hit the road');
    rec.opts().onError?.('aborted');
    expect(validation.transcript()).toBe(MESSAGES.listening);
  });

  it('latches denial and warns once on not-allowed', () => {
    const { validation, rec, mic, banner } = setup();
    validation.begin(0, 'hit the road');
    rec.opts().onError?.('not-allowed');

    expect(mic.markDenied).toHaveBeenCalledOnce();
    expect(validation.transcript()).toBe(MESSAGES.micDeniedInline);
    expect(banner.html()).toBe(MESSAGES.micDenied);
  });

  it('treats service-not-allowed the same way', () => {
    const { validation, rec, mic } = setup();
    validation.begin(0, 'hit the road');
    rec.opts().onError?.('service-not-allowed');
    expect(mic.markDenied).toHaveBeenCalledOnce();
  });

  it('skips validation on any other error and resolves the wait', async () => {
    const { validation, rec } = setup();
    let settled = false;
    void validation.begin(0, 'hit the road')!.then(() => { settled = true; });

    rec.opts().onError?.('network');
    await Promise.resolve();

    expect(validation.transcript()).toBe(MESSAGES.couldNotListen);
    expect(settled).toBe(true);
  });
});

describe('ValidationService disposal', () => {
  it('dispose aborts a live session and reports silence', () => {
    const { validation, rec } = setup();
    validation.begin(0, 'hit the road');
    validation.dispose();

    expect(rec.session.aborted).toBe(true);
    expect(validation.transcript()).toBe(MESSAGES.noSpeechDetected);
  });

  it('dispose leaves a completed result alone', async () => {
    const { validation, rec } = setup();
    void validation.begin(0, 'hit the road');
    rec.opts().onResult?.('hit the road');
    await Promise.resolve();
    validation.dispose();

    expect(validation.transcript()).toBe('hit the road');
    expect(validation.stars()).toBe(5);
  });

  it('clear removes the box entirely', () => {
    const { validation } = setup();
    validation.begin(0, 'hit the road');
    validation.clear();
    expect(validation.active()).toBe(false);
    expect(validation.lineIndex()).toBeNull();
  });
});

describe('ValidationService enable flow', () => {
  it('enable prompts for the mic and turns the setting on', async () => {
    const { validation, mic, settings } = setup();
    await expect(validation.enable()).resolves.toBe(true);
    expect(mic.ensure).toHaveBeenCalledOnce();
    expect(settings.sttEnabled()).toBe(true);
  });

  it('enable resolves false and stays off when the prompt is refused', async () => {
    const { validation, mic, settings } = setup();
    mic.ensure.mockRejectedValue(new Error('denied'));
    await expect(validation.enable()).resolves.toBe(false);
    expect(settings.sttEnabled()).toBe(false);
  });

  it('a second enable while the first is pending does not re-prompt', async () => {
    const { validation, mic } = setup();
    let release!: (v: unknown) => void;
    mic.ensure.mockReturnValue(new Promise((r) => { release = r; }));

    const first = validation.enable();
    const second = validation.enable();
    release({});
    await Promise.all([first, second]);

    expect(mic.ensure).toHaveBeenCalledOnce();
  });

  it('disable clears any open box and turns the setting off', () => {
    const { validation, settings } = setup();
    settings.setSttEnabled(true);
    validation.begin(0, 'hit the road');
    validation.disable();
    expect(validation.active()).toBe(false);
    expect(settings.sttEnabled()).toBe(false);
  });
});
