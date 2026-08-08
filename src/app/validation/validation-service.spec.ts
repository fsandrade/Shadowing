import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
  const sessions: Array<{ started: boolean; stopped: boolean; aborted: boolean }> = [];
  let opts: RecognitionOptions = {};
  const api = {
    sessions,
    opts: () => opts,
    latest: () => sessions[sessions.length - 1],
    speak: (text: string) => opts.onInterim?.(text),
    endWithFinalText: (text: string) => opts.onResult?.(text),
    impl: {
      supported: () => true,
      recognize: (o: RecognitionOptions) => {
        opts = o;
        const s = {
          started: false,
          stopped: false,
          aborted: false,
          start() { this.started = true; },
          stop() { this.stopped = true; },
          abort() { this.aborted = true; },
        };
        sessions.push(s);
        return s as unknown as RecognitionSession;
      },
    } as unknown as SpeechRecognizer,
  };
  return api;
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

describe('ValidationService end of speech', () => {
  const TARGET = 'I must have hit the snooze button like four times this morning';

  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('runs the session continuously so the browser cannot cut in on a pause', () => {
    const { validation, rec } = setup();
    validation.begin(0, TARGET);
    expect(rec.opts().continuous).toBe(true);
  });

  it('stops as soon as the whole sentence has been said', async () => {
    const { validation, rec } = setup();
    let settled = false;
    void validation.begin(0, TARGET)!.then(() => { settled = true; });

    rec.speak(TARGET);
    expect(rec.latest().stopped).toBe(true);

    rec.endWithFinalText(TARGET);
    await Promise.resolve();
    expect(settled).toBe(true);
  });

  it('tolerates pauses shorter than the grace window mid-sentence', async () => {
    const { validation, rec, resultAt } = setup();
    void validation.begin(0, TARGET);

    rec.speak('I must have');
    await vi.advanceTimersByTimeAsync(2000);
    expect(rec.latest().stopped).toBe(false);

    rec.speak('I must have hit the snooze');
    await vi.advanceTimersByTimeAsync(2000);
    expect(rec.latest().stopped).toBe(false);

    rec.speak('I must have hit the snooze button like four');
    await vi.advanceTimersByTimeAsync(2000);
    expect(rec.latest().stopped).toBe(false);
    expect(resultAt(0)?.status).toBe('listening');
  });

  it('stops once a pause outlasts the grace window', async () => {
    const { validation, rec } = setup();
    void validation.begin(0, TARGET);

    rec.speak('I must have hit');
    await vi.advanceTimersByTimeAsync(2400);
    expect(rec.latest().stopped).toBe(false);

    await vi.advanceTimersByTimeAsync(400);
    expect(rec.latest().stopped).toBe(true);
  });

  it('scores a partial repeat when the speaker gives up mid-sentence', async () => {
    const { validation, rec, resultAt } = setup();
    void validation.begin(0, TARGET);

    rec.speak('I must have hit the snooze');
    await vi.advanceTimersByTimeAsync(3000);
    rec.endWithFinalText('I must have hit the snooze');
    await Promise.resolve();

    expect(resultAt(0)?.status).toBe('scored');
    expect(resultAt(0)?.stars).not.toBeNull();
    expect(resultAt(0)?.stars).toBeLessThan(5);
  });

  it('waits longer than the pause window for a slow starter', async () => {
    const { validation, rec } = setup();
    void validation.begin(0, TARGET);

    await vi.advanceTimersByTimeAsync(4000);
    expect(rec.latest().stopped).toBe(false);

    rec.speak('I must have');
    await vi.advanceTimersByTimeAsync(1000);
    expect(rec.latest().stopped).toBe(false);
  });

  it('gives up when nothing is said at all', async () => {
    const { validation, rec, resultAt } = setup();
    void validation.begin(0, TARGET);

    await vi.advanceTimersByTimeAsync(5800);
    expect(rec.latest().stopped).toBe(false);

    await vi.advanceTimersByTimeAsync(400);
    expect(rec.latest().stopped).toBe(true);

    rec.endWithFinalText('');
    await Promise.resolve();
    expect(resultAt(0)?.transcript).toBe(MESSAGES.noSpeechDetected);
  });

  it('stops at the ceiling when someone talks without ever completing', async () => {
    const { validation, rec } = setup();
    void validation.begin(0, TARGET);

    for (let i = 0; i < 40; i++) {
      rec.speak(`rambling on and on segment ${i}`);
      await vi.advanceTimersByTimeAsync(1000);
      if (rec.latest().stopped) { break; }
    }
    expect(rec.latest().stopped).toBe(true);
  });

  it('settles from what it heard if stopping never reports a final result', async () => {
    const { validation, rec, resultAt } = setup();
    let settled = false;
    void validation.begin(0, TARGET)!.then(() => { settled = true; });

    rec.speak('I must have hit the snooze button');
    await vi.advanceTimersByTimeAsync(3000);
    expect(rec.latest().stopped).toBe(true);
    expect(settled).toBe(false);

    await vi.advanceTimersByTimeAsync(1600);
    expect(settled).toBe(true);
    expect(resultAt(0)?.transcript).toBe('I must have hit the snooze button');
    expect(resultAt(0)?.status).toBe('scored');
  });

  it('stops watching once a line is settled', async () => {
    const { validation, rec } = setup();
    void validation.begin(0, TARGET);
    rec.speak(TARGET);
    rec.endWithFinalText(TARGET);
    await Promise.resolve();

    const stoppedSessions = rec.sessions.length;
    await vi.advanceTimersByTimeAsync(60_000);
    expect(rec.sessions.length).toBe(stoppedSessions);
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

describe('ValidationService typing mode', () => {
  function typingSetup(options: { denied?: boolean } = {}) {
    const kit = setup(options);
    kit.settings.setTypingMode(true);
    return kit;
  }

  it('opens a typing result instead of listening', () => {
    const { validation, rec, resultAt } = typingSetup();
    const done = validation.begin(1, 'hit the road');

    expect(done).not.toBeNull();
    expect(validation.activeLine()).toBe(1);
    expect(resultAt(1)).toEqual({
      transcript: MESSAGES.typePrompt, stars: null, status: 'typing',
    });
    expect(rec.sessions.length).toBe(0);
  });

  it('never asks for the microphone', () => {
    const { validation, mic } = typingSetup();
    validation.begin(0, 'hit the road');
    expect(mic.ensure).not.toHaveBeenCalled();
  });

  it('works even when the microphone was denied', () => {
    const { validation, resultAt } = typingSetup({ denied: true });
    expect(validation.begin(0, 'hit the road')).not.toBeNull();
    expect(resultAt(0)?.status).toBe('typing');
  });

  it('scores what was typed and settles the turn', async () => {
    const { validation, resultAt } = typingSetup();
    const done = validation.begin(0, 'hit the road');

    validation.submitTyped('Hit the road');
    await done;

    expect(resultAt(0)?.stars).toBe(5);
    expect(resultAt(0)?.status).toBe('scored');
    expect(resultAt(0)?.transcript).toBe('Hit the road');
    expect(validation.activeLine()).toBeNull();
  });

  it('marks the words that were wrong', () => {
    const { validation, resultAt } = typingSetup();
    validation.begin(0, 'a quick clarification');
    validation.submitTyped('a quik clarification');

    expect(resultAt(0)?.stars).toBeLessThan(5);
    expect(resultAt(0)?.words).toEqual([
      { text: 'a', ok: true },
      { text: 'quik', ok: false },
      { text: 'clarification', ok: true },
    ]);
  });

  it('names the words that were left out', () => {
    const { validation, resultAt } = typingSetup();
    validation.begin(0, 'let me jump in with a quick note');
    validation.submitTyped('let me jump in with quick note');

    expect(resultAt(0)?.missed).toEqual(['a']);
  });

  it('holds the speller to the exact spelling, unlike speech', () => {
    const { validation, resultAt } = typingSetup();
    validation.begin(0, 'It looks gray outside');
    validation.submitTyped('It looks grey outside');

    expect(resultAt(0)?.stars).toBeLessThan(5);
  });

  it('treats an empty submission as nothing typed', async () => {
    const { validation, resultAt } = typingSetup();
    const done = validation.begin(0, 'hit the road');

    validation.submitTyped('   ');
    await done;

    expect(resultAt(0)).toEqual({
      transcript: MESSAGES.nothingTyped, stars: null, status: 'failed',
    });
  });

  it('ignores a submission when no turn is open', () => {
    const { validation, resultAt } = typingSetup();
    validation.submitTyped('nothing to score');
    expect(resultAt(0)).toBeUndefined();
  });

  it('marks an abandoned turn as nothing typed', async () => {
    const { validation, resultAt } = typingSetup();
    const done = validation.begin(3, 'hit the road');

    validation.dispose();
    await done;

    expect(resultAt(3)).toEqual({
      transcript: MESSAGES.nothingTyped, stars: null, status: 'failed',
    });
  });

  it('turns the validator on without the microphone', async () => {
    const { validation, mic, settings } = typingSetup();
    expect(await validation.enable()).toBe(true);
    expect(settings.sttEnabled()).toBe(true);
    expect(mic.ensure).not.toHaveBeenCalled();
  });

  it('goes back to listening when typing mode is switched off', () => {
    const { validation, rec, settings, resultAt } = typingSetup();
    settings.setTypingMode(false);
    validation.begin(0, 'hit the road');

    expect(rec.sessions.length).toBe(1);
    expect(resultAt(0)?.status).toBe('listening');
  });
});
