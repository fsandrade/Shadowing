import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Speaker } from './speaker';
import {
  SPEECH_SUPPORTED, SPEECH_SYNTHESIS, type UtteranceFactory, UTTERANCE_FACTORY,
} from './speech-synthesis';

class FakeUtterance {
  lang = '';
  rate = 1;
  voice: SpeechSynthesisVoice | null = null;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(public text: string) {}
}

function setup(
  overrides: Partial<SpeechSynthesis> = {},
  utteranceFactory: UtteranceFactory | 'default' = 'default',
) {
  const spoken: FakeUtterance[] = [];
  const synth = {
    speak: vi.fn((u: unknown) => void spoken.push(u as FakeUtterance)),
    cancel: vi.fn(),
    resume: vi.fn(),
    getVoices: vi.fn(() => [] as SpeechSynthesisVoice[]),
    addEventListener: vi.fn(),
    speaking: false,
    paused: false,
    ...overrides,
  } as unknown as SpeechSynthesis;

  const factory: UtteranceFactory = utteranceFactory === 'default'
    ? ((t: string) => new FakeUtterance(t) as unknown as SpeechSynthesisUtterance)
    : utteranceFactory;

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: SPEECH_SYNTHESIS, useValue: synth },
      { provide: UTTERANCE_FACTORY, useValue: factory },
      { provide: SPEECH_SUPPORTED, useValue: true },
    ],
  });
  return { speaker: TestBed.inject(Speaker), synth, spoken };
}

describe('Speaker', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('cancels any in-flight utterance before speaking', () => {
    const { speaker, synth } = setup();
    void speaker.speak('hello', { rate: 1, voice: null });
    expect(synth.cancel).toHaveBeenCalledOnce();
    expect(synth.speak).toHaveBeenCalledOnce();
  });

  it('applies rate, en-US lang and the chosen voice', () => {
    const voice = { name: 'David', lang: 'en-US' } as SpeechSynthesisVoice;
    const { speaker, spoken } = setup();
    void speaker.speak('hello', { rate: 1.4, voice });
    expect(spoken[0].text).toBe('hello');
    expect(spoken[0].lang).toBe('en-US');
    expect(spoken[0].rate).toBe(1.4);
    expect(spoken[0].voice).toBe(voice);
  });

  it('resolves on end', async () => {
    const { speaker, spoken } = setup();
    let settled = false;
    void speaker.speak('hello', { rate: 1, voice: null }).then(() => { settled = true; });
    spoken[0].onend?.();
    await Promise.resolve();
    expect(settled).toBe(true);
  });

  it('resolves on error', async () => {
    const { speaker, spoken } = setup();
    let settled = false;
    void speaker.speak('hello', { rate: 1, voice: null }).then(() => { settled = true; });
    spoken[0].onerror?.();
    await Promise.resolve();
    expect(settled).toBe(true);
  });

  it('resolves via the safety timeout when the voice never reports end', async () => {
    const { speaker } = setup();
    let settled = false;
    // 12 chars at rate 1 -> safetyTimeoutMs === 6000
    void speaker.speak('123456789012', { rate: 1, voice: null })
      .then(() => { settled = true; });

    await vi.advanceTimersByTimeAsync(5999);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(settled).toBe(true);
  });

  it('resolves exactly once when end and the timeout both fire', async () => {
    const { speaker, spoken } = setup();
    let count = 0;
    void speaker.speak('123456789012', { rate: 1, voice: null }).then(() => { count++; });
    spoken[0].onend?.();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(count).toBe(1);
  });

  it('resolves immediately when utterances are unavailable', async () => {
    const { speaker, synth } = setup({}, null);
    await expect(speaker.speak('hello', { rate: 1, voice: null })).resolves.toBeUndefined();
    expect(synth.speak).not.toHaveBeenCalled();
  });

  it('keepAlive resumes only while speaking and not already paused', () => {
    const a = setup({ speaking: true, paused: false });
    a.speaker.keepAlive();
    expect(a.synth.resume).toHaveBeenCalledOnce();

    const b = setup({ speaking: true, paused: true });
    b.speaker.keepAlive();
    expect(b.synth.resume).not.toHaveBeenCalled();

    const c = setup({ speaking: false, paused: false });
    c.speaker.keepAlive();
    expect(c.synth.resume).not.toHaveBeenCalled();
  });

  it('exposes the platform voice list and the voiceschanged hook', () => {
    const voices = [{ name: 'David', lang: 'en-US' }] as SpeechSynthesisVoice[];
    const { speaker, synth } = setup({ getVoices: () => voices });
    expect(speaker.voices()).toBe(voices);

    const fn = () => {};
    speaker.onVoicesChanged(fn);
    expect(synth.addEventListener).toHaveBeenCalledWith('voiceschanged', fn);
  });
});
