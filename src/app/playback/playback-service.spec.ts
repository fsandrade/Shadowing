import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type Corpus } from '../core/deck';
import { Speaker } from '../platform/speaker';
import { SafeStorage } from '../platform/storage';
import { BannerStore } from '../state/banner-store';
import { CORPUS_DATA } from '../state/corpus-token';
import { MESSAGES } from '../state/messages';
import { PracticeStore } from '../state/practice-store';
import { SessionTimerStore } from '../state/session-timer-store';
import { SettingsStore } from '../state/settings-store';
import { PlaybackService } from './playback-service';

const DATA: Corpus = {
  generatedAt: '2026-08-06T00:00:00Z',
  decks: [{
    id: 'a',
    name: 'A',
    lines: [
      'first <b>line</b> is long enough to measure',
      'second line is long enough to measure',
      'third line is long enough to measure',
    ],
  }],
};

/** Speaker fake whose utterances take a controllable amount of fake time. */
function fakeSpeaker(speakMs: number) {
  let ms = speakMs;
  const spoken: string[] = [];
  const impl = {
    supported: true,
    voices: () => [{ name: 'David', lang: 'en-US' }] as SpeechSynthesisVoice[],
    onVoicesChanged: () => {},
    cancel: vi.fn(),
    keepAlive: vi.fn(),
    speak: vi.fn((text: string) => {
      spoken.push(text);
      return new Promise<void>((resolve) => setTimeout(resolve, ms));
    }),
  } as unknown as Speaker;
  return { spoken, impl, setSpeakMs: (next: number) => { ms = next; } };
}

function setup(speakMs = 1000, corpus: Corpus = DATA) {
  const speaker = fakeSpeaker(speakMs);
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      {
        provide: SafeStorage,
        useValue: { read: () => null, write: () => {} } as unknown as SafeStorage,
      },
      { provide: CORPUS_DATA, useValue: corpus },
      { provide: Speaker, useValue: speaker.impl },
    ],
  });
  return {
    speaker,
    playback: TestBed.inject(PlaybackService),
    practice: TestBed.inject(PracticeStore),
    settings: TestBed.inject(SettingsStore),
    timer: TestBed.inject(SessionTimerStore),
    banner: TestBed.inject(BannerStore),
  };
}

describe('PlaybackService transport', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('speaks the current line with markup stripped', async () => {
    const { playback, speaker } = setup();
    playback.play();
    await vi.advanceTimersByTimeAsync(0);
    expect(speaker.spoken[0]).toBe('first line is long enough to measure');
  });

  it('advances after speaking plus the gap', async () => {
    const { playback, practice } = setup(1000);
    playback.play();
    await vi.advanceTimersByTimeAsync(1000); // speech
    expect(practice.index()).toBe(0);
    await vi.advanceTimersByTimeAsync(1000); // gap at slack 1
    expect(practice.index()).toBe(1);
  });

  it('marks the line just passed as spoken before advancing', async () => {
    const { playback, practice } = setup(1000);
    playback.play();
    await vi.advanceTimersByTimeAsync(2000);
    expect(practice.spoken().has(0)).toBe(true);
    expect(practice.index()).toBe(1);
  });

  it('wraps at the end of the deck', async () => {
    const { playback, practice } = setup(1000);
    practice.goTo(2);
    playback.play();
    await vi.advanceTimersByTimeAsync(2000);
    expect(practice.index()).toBe(0);
  });

  it('pause stops the loop and cancels speech', async () => {
    const { playback, practice, speaker } = setup(1000);
    playback.play();
    await vi.advanceTimersByTimeAsync(500);
    playback.pause();

    expect(practice.playing()).toBe(false);
    expect(speaker.impl.cancel).toHaveBeenCalled();

    const before = speaker.spoken.length;
    await vi.advanceTimersByTimeAsync(10_000);
    expect(speaker.spoken.length).toBe(before);
  });

  it('toggle flips between playing and paused', () => {
    const { playback, practice } = setup();
    playback.toggle();
    expect(practice.playing()).toBe(true);
    playback.toggle();
    expect(practice.playing()).toBe(false);
  });

  it('does nothing when there are no lines', () => {
    const { playback, practice } = setup();
    practice.selectDeck('missing');
    playback.play();
    expect(practice.playing()).toBe(false);
  });

  it('next advances immediately and restarts the loop while playing', async () => {
    const { playback, practice, speaker } = setup(1000);
    playback.play();
    await vi.advanceTimersByTimeAsync(100);
    playback.next();

    expect(practice.index()).toBe(1);
    expect(practice.spoken().has(0)).toBe(true);
    await vi.advanceTimersByTimeAsync(0);
    expect(speaker.spoken.at(-1)).toBe('second line is long enough to measure');
  });

  it('next while paused moves without speaking', async () => {
    const { playback, practice, speaker } = setup();
    playback.next();
    await vi.advanceTimersByTimeAsync(0);
    expect(practice.index()).toBe(1);
    expect(speaker.spoken).toEqual([]);
  });

  it('shuffle reorders, resets to the top and keeps playing', async () => {
    const { playback, practice } = setup(1000);
    playback.play();
    await vi.advanceTimersByTimeAsync(2000);
    expect(practice.index()).toBe(1);

    playback.shuffle(() => 0);
    expect(practice.index()).toBe(0);
    expect(practice.playing()).toBe(true);
    expect([...practice.lines()].sort()).toEqual([...DATA.decks[0].lines].sort());
  });

  it('playLine speaks one line without starting the loop', async () => {
    const { playback, practice, speaker } = setup(1000);
    playback.playLine(2);
    expect(practice.index()).toBe(2);
    expect(practice.playing()).toBe(false);
    await vi.advanceTimersByTimeAsync(0);
    expect(speaker.spoken).toEqual(['third line is long enough to measure']);
  });
});

describe('PlaybackService cancellation', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('a deck switch mid-gap does not advance the new deck', async () => {
    const { playback, practice } = setup(1000);
    playback.play();
    await vi.advanceTimersByTimeAsync(1200); // into the gap
    playback.stop();
    practice.selectDeck('a');

    await vi.advanceTimersByTimeAsync(10_000);
    expect(practice.index()).toBe(0);
  });

  it('restarting mid-gap does not leave two loops running', async () => {
    const { playback, speaker } = setup(1000);
    playback.play();
    await vi.advanceTimersByTimeAsync(1200);
    playback.play();
    await vi.advanceTimersByTimeAsync(4000);

    // Two concurrent loops would roughly double this count.
    expect(speaker.spoken.length).toBeLessThanOrEqual(4);
  });
});

describe('PlaybackService gap timing', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('scales the gap by the slack setting', async () => {
    const { playback, practice, settings } = setup(1000);
    settings.setSlack(2);
    playback.play();
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(1500);
    expect(practice.index()).toBe(0);
    await vi.advanceTimersByTimeAsync(500);
    expect(practice.index()).toBe(1);
  });

  it('never waits less than the 400 ms floor', async () => {
    const { playback, practice, settings } = setup(200);
    settings.setSlack(0);
    playback.play();
    await vi.advanceTimersByTimeAsync(200);
    await vi.advanceTimersByTimeAsync(399);
    expect(practice.index()).toBe(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(practice.index()).toBe(1);
  });

  it('reports gap progress from 0 to 1', async () => {
    const { playback } = setup(1000);
    playback.play();
    await vi.advanceTimersByTimeAsync(1000);
    expect(playback.progress()).toBe(0);
    await vi.advanceTimersByTimeAsync(500);
    expect(playback.progress()).toBeGreaterThan(0);
    expect(playback.progress()).toBeLessThanOrEqual(1);
  });

  it('flags inGap for the whole gap and clears it afterwards', async () => {
    const { playback } = setup(1000);
    expect(playback.inGap()).toBe(false);

    playback.play();
    await vi.advanceTimersByTimeAsync(1000); // speech done, gap starts
    expect(playback.inGap()).toBe(true);
    // Present from the first frame, before any progress has accrued.
    expect(playback.progress()).toBe(0);

    await vi.advanceTimersByTimeAsync(1000); // gap done
    expect(playback.inGap()).toBe(false);
  });

  it('clears inGap when playback is stopped mid-gap', async () => {
    const { playback } = setup(1000);
    playback.play();
    await vi.advanceTimersByTimeAsync(1200);
    expect(playback.inGap()).toBe(true);
    playback.pause();
    expect(playback.inGap()).toBe(false);
  });
});

describe('PlaybackService dead-voice detection', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('stops and warns after three silent utterances in a row', async () => {
    const { playback, practice, banner } = setup(0);
    playback.play();
    await vi.advanceTimersByTimeAsync(5000);

    expect(practice.playing()).toBe(false);
    expect(banner.html()).toBe(MESSAGES.deadVoice);
  });

  it('does not count a short utterance of short text as a failure', async () => {
    const short: Corpus = {
      generatedAt: '2026-08-06T00:00:00Z',
      decks: [{ id: 'a', name: 'A', lines: ['hi', 'yo', 'ok'] }],
    };
    const { playback, banner } = setup(0, short);
    playback.play();
    await vi.advanceTimersByTimeAsync(5000);
    expect(banner.html()).not.toBe(MESSAGES.deadVoice);
  });

  it('resets the failure streak after a healthy utterance', async () => {
    const { playback, speaker, banner } = setup(0);
    playback.play();
    await vi.advanceTimersByTimeAsync(500);
    speaker.setSpeakMs(1000);
    await vi.advanceTimersByTimeAsync(4000);
    expect(banner.html()).not.toBe(MESSAGES.deadVoice);
  });

  it('counts only healthy utterances toward the session tally', async () => {
    const { playback, timer } = setup(1000);
    playback.play();
    await vi.advanceTimersByTimeAsync(4000);
    expect(timer.spokenCount()).toBeGreaterThan(0);
  });
});

describe('PlaybackService session expiry', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('finishes with a summary once a timed session runs out', async () => {
    const { playback, practice, settings, timer, banner } = setup(1000);
    settings.setDurationMin(1);
    timer.reset(1);

    playback.play();
    await vi.advanceTimersByTimeAsync(70_000);

    expect(practice.playing()).toBe(false);
    // How many lines got through varies with the loop; the format does not.
    expect(banner.html()).toMatch(/^Session complete: 1 min · \d+ sentences? repeated\.$/);
    expect(timer.spokenCount()).toBe(0);
  });

  it('does not finish an unlimited session', async () => {
    const { playback, practice, banner } = setup(1000);
    playback.play();
    await vi.advanceTimersByTimeAsync(120_000);
    expect(practice.playing()).toBe(true);
    expect(banner.visible()).toBe(false);
  });

  // The vanilla loop checks expiry twice per iteration — once after the speak
  // and again after the gap. These two cases are what distinguish them: with
  // only the post-gap check the first would run a needless gap, and with only
  // the post-speak check the second would advance a line past the deadline.

  it('catches expiry at the post-speak checkpoint, before running a gap', async () => {
    const { playback, practice, settings, timer, banner } = setup(1000);
    settings.setDurationMin(1);
    timer.reset(1);
    timer.remainingMs.set(500); // runs out partway through the first utterance

    playback.play();
    await vi.advanceTimersByTimeAsync(1000); // speech only

    // Exactly one healthy utterance completed before the deadline.
    expect(banner.html()).toBe(MESSAGES.sessionSummary(1, 1));
    expect(playback.inGap()).toBe(false);
    expect(practice.playing()).toBe(false);
    expect(practice.index()).toBe(0);
  });

  it('catches expiry at the post-gap checkpoint, before advancing', async () => {
    const { playback, practice, settings, timer, banner } = setup(1000);
    settings.setDurationMin(1);
    timer.reset(1);
    timer.remainingMs.set(1500); // survives the speak, runs out during the gap

    playback.play();
    await vi.advanceTimersByTimeAsync(1000); // speech done, still inside budget
    expect(banner.visible()).toBe(false);
    expect(playback.inGap()).toBe(true);

    await vi.advanceTimersByTimeAsync(1000); // gap elapses, now over budget
    expect(banner.html()).toBe(MESSAGES.sessionSummary(1, 1));
    expect(practice.playing()).toBe(false);
    expect(practice.index()).toBe(0);
  });
});

describe('PlaybackService validation hook', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('ends the gap early when validation resolves first', async () => {
    const { playback, practice } = setup(1000);
    let release!: () => void;
    playback.setValidationHook(() => new Promise<void>((r) => { release = r; }));

    playback.play();
    await vi.advanceTimersByTimeAsync(1000);
    release();
    await vi.advanceTimersByTimeAsync(0);
    expect(practice.index()).toBe(1);
  });

  it('still ends the gap on time when validation never resolves', async () => {
    const { playback, practice } = setup(1000);
    playback.setValidationHook(() => new Promise<void>(() => {}));

    playback.play();
    await vi.advanceTimersByTimeAsync(2000);
    expect(practice.index()).toBe(1);
  });

  it('passes the line index and the stripped text to the hook', async () => {
    const { playback } = setup(1000);
    const calls: Array<[number, string]> = [];
    playback.setValidationHook((i, text) => { calls.push([i, text]); return null; });

    playback.play();
    await vi.advanceTimersByTimeAsync(1000);
    expect(calls[0]).toEqual([0, 'first line is long enough to measure']);
  });
});
