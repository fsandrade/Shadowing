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

function fakeRecognizer() {
  const sessions: Array<{ started: boolean; aborted: boolean }> = [];
  let opts: RecognitionOptions = {};
  return {
    sessions,
    opts: () => opts,
    impl: {
      supported: () => true,
      recognize: (o: RecognitionOptions) => {
        opts = o;
        const s = {
          started: false,
          aborted: false,
          start() { this.started = true; },
          stop() {},
          abort() { this.aborted = true; },
        };
        sessions.push(s);
        return s as unknown as RecognitionSession;
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
  const validation = TestBed.inject(ValidationService);
  return {
    rec,
    mic,
    validation,
    banner: TestBed.inject(BannerStore),
    settings: TestBed.inject(SettingsStore),
    resultAt: (i: number) => validation.results().get(i),
  };
}

describe('ValidationService session', () => {
  it('opens a listening result for the given line', () => {
    const { validation, rec, resultAt } = setup();
    validation.begin(2, 'hit the road');

    expect(validation.activeLine()).toBe(2);
    expect(resultAt(2)).toEqual({
      transcript: MESSAGES.listening, stars: null, status: 'listening',
    });
    expect(rec.sessions[0].started).toBe(true);
    expect(rec.opts().lang).toBe('en-US');
  });

  it('shows interim text as it arrives', () => {
    const { validation, rec, resultAt } = setup();
    validation.begin(0, 'hit the road');
    rec.opts().onInterim?.('hit the');
    expect(resultAt(0)?.transcript).toBe('hit the');
  });

  it('rates a good repeat and resolves the wait', async () => {
    const { validation, rec, resultAt } = setup();
    let settled = false;
    void validation.begin(0, 'hit the road')!.then(() => { settled = true; });

    rec.opts().onResult?.('hit the road');
    await Promise.resolve();

    expect(resultAt(0)).toEqual({ transcript: 'hit the road', stars: 5, status: 'scored' });
    expect(settled).toBe(true);
  });

  it('reports silence without stars', async () => {
    const { validation, rec, resultAt } = setup();
    void validation.begin(0, 'hit the road');
    rec.opts().onResult?.('');
    await Promise.resolve();

    expect(resultAt(0)).toEqual({
      transcript: MESSAGES.noSpeechDetected, stars: null, status: 'failed',
    });
  });

  it('returns null instead of a session once the mic is denied', () => {
    const { validation } = setup({ denied: true });
    expect(validation.begin(0, 'hit the road')).toBeNull();
    expect(validation.results().size).toBe(0);
  });
});

describe('ValidationService history', () => {
  it('keeps a result for every line practised', async () => {
    const { validation, rec, resultAt } = setup();

    void validation.begin(0, 'one two three');
    rec.opts().onResult?.('one two three');
    await Promise.resolve();

    void validation.begin(1, 'four five six');
    rec.opts().onResult?.('four five');
    await Promise.resolve();

    expect(validation.results().size).toBe(2);
    expect(resultAt(0)).toEqual({ transcript: 'one two three', stars: 5, status: 'scored' });
    expect(resultAt(1)?.transcript).toBe('four five');
    expect(resultAt(1)?.stars).toBeLessThan(5);
  });

  it('only the newest line is active', async () => {
    const { validation, rec } = setup();
    void validation.begin(0, 'one two three');
    rec.opts().onResult?.('one two three');
    await Promise.resolve();

    validation.begin(1, 'four five six');
    expect(validation.activeLine()).toBe(1);
  });

  it('finalizes a silent previous line when the next one starts', () => {
    const { validation, resultAt } = setup();
    validation.begin(0, 'one two three');
    validation.begin(1, 'four five six');

    expect(resultAt(0)?.transcript).toBe(MESSAGES.noSpeechDetected);
    expect(resultAt(1)?.transcript).toBe(MESSAGES.listening);
  });

  it('reset drops the whole history', async () => {
    const { validation, rec } = setup();
    void validation.begin(0, 'one two three');
    rec.opts().onResult?.('one two three');
    await Promise.resolve();

    validation.reset();
    expect(validation.results().size).toBe(0);
    expect(validation.activeLine()).toBeNull();
  });
});

describe('ValidationService error handling', () => {
  it('ignores an aborted error, since that is our own cancellation', () => {
    const { validation, rec, resultAt } = setup();
    void validation.begin(0, 'hit the road');
    rec.opts().onError?.('aborted');
    expect(resultAt(0)?.transcript).toBe(MESSAGES.listening);
  });

  it('latches denial and warns once on not-allowed', () => {
    const { validation, rec, mic, banner, resultAt } = setup();
    validation.begin(0, 'hit the road');
    rec.opts().onError?.('not-allowed');

    expect(mic.markDenied).toHaveBeenCalledOnce();
    expect(resultAt(0)?.transcript).toBe(MESSAGES.micDeniedInline);
    expect(banner.html()).toBe(MESSAGES.micDenied);
  });

  it('treats service-not-allowed the same way', () => {
    const { validation, rec, mic } = setup();
    validation.begin(0, 'hit the road');
    rec.opts().onError?.('service-not-allowed');
    expect(mic.markDenied).toHaveBeenCalledOnce();
  });

  it('skips validation on any other error and resolves the wait', async () => {
    const { validation, rec, resultAt } = setup();
    let settled = false;
    void validation.begin(0, 'hit the road')!.then(() => { settled = true; });

    rec.opts().onError?.('network');
    await Promise.resolve();

    expect(resultAt(0)?.transcript).toBe(MESSAGES.couldNotListen);
    expect(settled).toBe(true);
  });
});

describe('ValidationService disposal', () => {
  it('dispose aborts a live session and reports silence, keeping the box', () => {
    const { validation, rec, resultAt } = setup();
    validation.begin(0, 'hit the road');
    validation.dispose();

    expect(rec.sessions[0].aborted).toBe(true);
    expect(resultAt(0)?.transcript).toBe(MESSAGES.noSpeechDetected);
    expect(validation.activeLine()).toBeNull();
  });

  it('dispose leaves a completed result alone', async () => {
    const { validation, rec, resultAt } = setup();
    void validation.begin(0, 'hit the road');
    rec.opts().onResult?.('hit the road');
    await Promise.resolve();
    validation.dispose();

    expect(resultAt(0)).toEqual({ transcript: 'hit the road', stars: 5, status: 'scored' });
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

  it('disable clears the history and turns the setting off', () => {
    const { validation, settings } = setup();
    settings.setSttEnabled(true);
    validation.begin(0, 'hit the road');
    validation.disable();

    expect(validation.results().size).toBe(0);
    expect(settings.sttEnabled()).toBe(false);
  });
});
