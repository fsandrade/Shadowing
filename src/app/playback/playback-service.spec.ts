import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { activityById } from '../core/activity';
import { Speaker } from '../platform/speaker';
import { SafeStorage } from '../platform/storage';
import { BannerStore } from '../state/banner-store';
import { CATALOG } from '../state/catalog-token';
import { CustomTopicStore } from '../state/custom-topic-store';
import { FlowStore } from '../state/flow-store';
import { MESSAGES } from '../state/messages';
import { PracticeStore } from '../state/practice-store';
import { SessionTimerStore } from '../state/session-timer-store';
import { SettingsStore } from '../state/settings-store';
import { PlaybackService } from './playback-service';
import { NO_SHUFFLE, signedOutBackend, storedProfile } from '../testing/catalog';
import type { Catalog } from '../core/catalog';
import { RANDOM } from '../platform/rng';

const DATA: Catalog = {
  loadedAt: '2026-08-06T00:00:00Z',
  levels: [{ id: 'A2', description: 'Elementary' }],
  topics: [{ id: 'a', name: 'A' }],
  sentences: [
    { id: 's-0', topicId: 'a', levelId: 'A2', text: 'first <b>line</b> is long enough to measure' },
    { id: 's-1', topicId: 'a', levelId: 'A2', text: 'second line is long enough to measure' },
    { id: 's-2', topicId: 'a', levelId: 'A2', text: 'third line is long enough to measure' },
  ],
};

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

function setup(speakMs = 1000, corpus: Catalog = DATA) {
  const speaker = fakeSpeaker(speakMs);
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      ...signedOutBackend(),
      {
        provide: SafeStorage,
        useValue: storedProfile() as unknown as SafeStorage,
      },
      { provide: CATALOG, useValue: corpus },
      { provide: RANDOM, useValue: NO_SHUFFLE },
      { provide: Speaker, useValue: speaker.impl },
    ],
  });
  const settings = TestBed.inject(SettingsStore);
  const timer = TestBed.inject(SessionTimerStore);
  // Mirror AppStartup: a real session always starts with its timer seeded,
  // so tests that are not about expiry get a duration long enough to ignore.
  timer.reset(settings.durationMin());
  return {
    speaker,
    playback: TestBed.inject(PlaybackService),
    practice: TestBed.inject(PracticeStore),
    settings,
    timer,
    banner: TestBed.inject(BannerStore),
    custom: TestBed.inject(CustomTopicStore),
    flow: TestBed.inject(FlowStore),
  };
}

describe('PlaybackService speaking custom text', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('speaks a custom sentence verbatim', async () => {
    const { playback, practice, custom, speaker } = setup();
    custom.setText('This sentence is long enough to measure.');
    practice.useCustomText();

    playback.play();
    await vi.advanceTimersByTimeAsync(0);
    expect(speaker.spoken[0]).toBe('This sentence is long enough to measure.');
  });

  it('keeps angle brackets, which tag stripping would swallow', async () => {
    const { playback, practice, custom, speaker } = setup();
    custom.setText('Five < ten is definitely a true statement.');
    practice.useCustomText();

    playback.play();
    await vi.advanceTimersByTimeAsync(0);
    expect(speaker.spoken[0]).toBe('Five < ten is definitely a true statement.');
  });
});

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
    await vi.advanceTimersByTimeAsync(1000);
    expect(practice.index()).toBe(0);
    await vi.advanceTimersByTimeAsync(1000);
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
    practice.selectTopic('missing');
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
    expect([...practice.lines()].sort())
      .toEqual(DATA.sentences.map((s) => s.text).sort());
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
    await vi.advanceTimersByTimeAsync(1200);
    playback.stop();
    practice.selectTopic('a');

    await vi.advanceTimersByTimeAsync(10_000);
    expect(practice.index()).toBe(0);
  });

  it('restarting mid-gap does not leave two loops running', async () => {
    const { playback, speaker } = setup(1000);
    playback.play();
    await vi.advanceTimersByTimeAsync(1200);
    playback.play();
    await vi.advanceTimersByTimeAsync(4000);

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
    await vi.advanceTimersByTimeAsync(1000);
    expect(playback.inGap()).toBe(true);

    expect(playback.progress()).toBe(0);

    await vi.advanceTimersByTimeAsync(1000);
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
    const short: Catalog = {
      loadedAt: '2026-08-06T00:00:00Z',
      levels: [{ id: 'A2', description: 'Elementary' }],
      topics: [{ id: 'a', name: 'A' }],
      sentences: ['hi', 'yo', 'ok'].map((text, i) => ({
        id: `s-${i}`, topicId: 'a', levelId: 'A2', text,
      })),
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

  it('a fresh Play retracts the dead-voice complaint it raised itself', async () => {
    const { playback, banner } = setup(0);
    playback.play();
    await vi.advanceTimersByTimeAsync(5000);
    expect(banner.html()).toBe(MESSAGES.deadVoice);

    playback.play();
    expect(banner.html()).toBeNull();
    playback.pause();
  });

  it('a fresh Play leaves the refused-microphone warning standing', () => {
    const { playback, banner } = setup(1000);
    // Raised by FlowStore.start() when Speaking degrades to unscored. Pressing
    // Play does not un-deny the microphone, so it must survive.
    banner.show(MESSAGES.micDenied, 'stt-denied');

    playback.play();

    expect(banner.html()).toBe(MESSAGES.micDenied);
    playback.pause();
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

  // Expiry now ends the activity rather than raising a banner, and finish() is
  // a no-op unless a session is running - so these tests have to start one.
  // start() also applies the level's pacing; the gap arithmetic below is
  // written in whole speech lengths, so put the slack back to 1.
  async function startSession(
    t: { flow: FlowStore; settings: SettingsStore },
    minutes: number,
  ): Promise<void> {
    await t.flow.start(activityById('shadowing')!, 'a', minutes);
    t.settings.setSlack(1);
  }

  const SHADOWING = activityById('shadowing')!;

  it('finishes and reports the session once a timed session runs out', async () => {
    const t = setup(1000);
    await startSession(t, 1);

    t.playback.play();
    await vi.advanceTimersByTimeAsync(70_000);

    expect(t.practice.playing()).toBe(false);
    expect(t.flow.screen()).toBe('summary');
    expect(t.flow.result()).toEqual({
      activity: SHADOWING, topicId: 'a', practisedMs: 60_000, spoken: 3, stars: null,
    });
    expect(t.timer.spokenCount()).toBe(0);
  });

  it('includes the stars won once the validator has scored', async () => {
    const t = setup(1000);
    await startSession(t, 1);
    t.playback.setValidationHook((lineIndex) => {
      t.timer.recordStars(lineIndex, 4);
      return Promise.resolve();
    });

    t.playback.play();
    await vi.advanceTimersByTimeAsync(70_000);

    expect(t.flow.result()).toEqual({
      activity: SHADOWING, topicId: 'a', practisedMs: 60_000, spoken: 3, stars: 12,
    });
  });

  it('counts a repeated sentence and its stars only once', async () => {
    const t = setup(1000);
    await startSession(t, 1);
    let scored = 0;
    t.playback.setValidationHook((lineIndex) => {
      scored++;
      t.timer.recordStars(lineIndex, 5);
      return Promise.resolve();
    });
    t.playback.setRepeatPolicy((_, repeatsDone) => repeatsDone < 2);

    t.playback.play();
    await vi.advanceTimersByTimeAsync(70_000);

    expect(scored).toBeGreaterThan(3);
    expect(t.flow.result()).toEqual({
      activity: SHADOWING, topicId: 'a', practisedMs: 60_000, spoken: 3, stars: 15,
    });
  });

  it('does not finish while time remains in the session', async () => {
    const t = setup(1000);
    await startSession(t, 10);

    t.playback.play();
    await vi.advanceTimersByTimeAsync(120_000);

    expect(t.practice.playing()).toBe(true);
    expect(t.flow.screen()).toBe('practice');
    expect(t.flow.result()).toBeNull();
  });

  it('catches expiry at the post-speak checkpoint, before running a gap', async () => {
    const t = setup(1000);
    await startSession(t, 1);
    t.timer.remainingMs.set(500);

    t.playback.play();
    await vi.advanceTimersByTimeAsync(1000);

    expect(t.flow.result()).toEqual({
      activity: SHADOWING, topicId: 'a', practisedMs: 60_000, spoken: 1, stars: null,
    });
    expect(t.playback.inGap()).toBe(false);
    expect(t.practice.playing()).toBe(false);
    expect(t.practice.index()).toBe(0);
  });

  it('catches expiry at the post-gap checkpoint, before advancing', async () => {
    const t = setup(1000);
    await startSession(t, 1);
    t.timer.remainingMs.set(1500);

    t.playback.play();
    await vi.advanceTimersByTimeAsync(1000);
    expect(t.flow.result()).toBeNull();
    expect(t.playback.inGap()).toBe(true);

    await vi.advanceTimersByTimeAsync(1000);
    expect(t.flow.result()).toEqual({
      activity: SHADOWING, topicId: 'a', practisedMs: 60_000, spoken: 1, stars: null,
    });
    expect(t.practice.playing()).toBe(false);
    expect(t.practice.index()).toBe(0);
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

  it('keeps listening past the gap duration until speech ends', async () => {
    const { playback, practice } = setup(1000);
    let release!: () => void;
    playback.setValidationHook(() => new Promise<void>((r) => { release = r; }));

    playback.play();
    await vi.advanceTimersByTimeAsync(1000);

    await vi.advanceTimersByTimeAsync(60_000);
    expect(practice.index()).toBe(0);
    expect(playback.inGap()).toBe(true);

    release();
    await vi.advanceTimersByTimeAsync(0);
    expect(practice.index()).toBe(1);
  });

  it('holds the ring full while it waits past the gap duration', async () => {
    const { playback } = setup(1000);
    playback.setValidationHook(() => new Promise<void>(() => {}));

    playback.play();
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(5000);
    expect(playback.progress()).toBe(1);
  });

  it('a transport control still interrupts an open listening session', async () => {
    const { playback, practice } = setup(1000);
    playback.setValidationHook(() => new Promise<void>(() => {}));

    playback.play();
    await vi.advanceTimersByTimeAsync(1000);
    expect(playback.inGap()).toBe(true);

    playback.pause();
    expect(playback.inGap()).toBe(false);
    expect(practice.playing()).toBe(false);
  });

  it('falls back to the timed gap when the validator declines the line', async () => {
    const { playback, practice } = setup(1000);
    playback.setValidationHook(() => null);

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

describe('PlaybackService repeat until five', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('replays the same line instead of advancing', async () => {
    const { playback, practice, speaker } = setup(1000);
    playback.setValidationHook(() => Promise.resolve());
    playback.setRepeatPolicy(() => true);

    playback.play();
    await vi.advanceTimersByTimeAsync(4000);

    expect(practice.index()).toBe(0);
    expect(speaker.spoken.length).toBeGreaterThan(1);
    expect(new Set(speaker.spoken).size).toBe(1);
  });

  it('advances as soon as the policy is satisfied', async () => {
    const { playback, practice } = setup(1000);
    playback.setValidationHook(() => Promise.resolve());
    playback.setRepeatPolicy((_, repeatsDone) => repeatsDone < 2);

    playback.play();
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(1000);
    expect(practice.index()).toBe(0);

    await vi.advanceTimersByTimeAsync(4000);
    expect(practice.index()).toBeGreaterThan(0);
  });

  it('counts repeats from zero again on the next line', async () => {
    const { playback, practice } = setup(1000);
    const seen: number[] = [];
    playback.setValidationHook(() => Promise.resolve());
    playback.setRepeatPolicy((_, repeatsDone) => {
      seen.push(repeatsDone);
      return repeatsDone < 1;
    });

    playback.play();
    await vi.advanceTimersByTimeAsync(10_000);

    expect(seen.slice(0, 4)).toEqual([0, 1, 0, 1]);
    expect(practice.index()).toBeGreaterThan(0);
  });

  it('does not mark a line spoken while it is still being repeated', async () => {
    const { playback, practice } = setup(1000);
    playback.setValidationHook(() => Promise.resolve());
    playback.setRepeatPolicy(() => true);

    playback.play();
    await vi.advanceTimersByTimeAsync(4000);
    expect(practice.spoken().has(0)).toBe(false);
  });

  it('lets a transport command break out of the repeats', async () => {
    const { playback, practice } = setup(1000);
    playback.setValidationHook(() => Promise.resolve());
    playback.setRepeatPolicy(() => true);

    playback.play();
    await vi.advanceTimersByTimeAsync(4000);
    expect(practice.index()).toBe(0);

    playback.next();
    expect(practice.index()).toBe(1);

    await vi.advanceTimersByTimeAsync(4000);
    expect(practice.index()).toBe(1);
  });

  it('advances normally when no policy is set', async () => {
    const { playback, practice } = setup(1000);
    playback.setValidationHook(() => Promise.resolve());
    playback.setRepeatPolicy(null);

    playback.play();
    await vi.advanceTimersByTimeAsync(1000);
    expect(practice.index()).toBe(1);
  });
});

describe('PlaybackService on-demand line', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('speaks a clicked line and listens for it when the validator is on', async () => {
    const { playback, practice, speaker } = setup(1000);
    const calls: Array<[number, string]> = [];
    let release!: () => void;
    playback.setValidationHook((i, text) => {
      calls.push([i, text]);
      return new Promise<void>((r) => { release = r; });
    });

    playback.playLine(2);
    await vi.advanceTimersByTimeAsync(1000);

    expect(speaker.spoken).toEqual(['third line is long enough to measure']);
    expect(calls).toEqual([[2, 'third line is long enough to measure']]);
    expect(playback.inGap()).toBe(true);
    expect(practice.playing()).toBe(false);

    release();
    await vi.advanceTimersByTimeAsync(0);
    expect(playback.inGap()).toBe(false);
  });

  it('does not advance to the next line afterwards', async () => {
    const { playback, practice } = setup(1000);
    playback.setValidationHook(() => Promise.resolve());

    playback.playLine(1);
    await vi.advanceTimersByTimeAsync(5000);
    expect(practice.index()).toBe(1);
    expect(practice.playing()).toBe(false);
  });

  it('marks the clicked line spoken once it has been listened to', async () => {
    const { playback, practice } = setup(1000);
    playback.setValidationHook(() => Promise.resolve());

    playback.playLine(1);
    await vi.advanceTimersByTimeAsync(1000);
    expect(practice.spoken().has(1)).toBe(true);
  });

  it('just speaks the line when the validator is off', async () => {
    const { playback, practice, speaker } = setup(1000);
    playback.setValidationHook(() => null);

    playback.playLine(2);
    await vi.advanceTimersByTimeAsync(2000);

    expect(speaker.spoken).toEqual(['third line is long enough to measure']);
    expect(playback.inGap()).toBe(false);
    expect(practice.spoken().has(2)).toBe(false);
  });

  it('clicking another line abandons the open session', async () => {
    const { playback } = setup(1000);
    playback.setValidationHook(() => new Promise<void>(() => {}));

    playback.playLine(0);
    await vi.advanceTimersByTimeAsync(1000);
    expect(playback.inGap()).toBe(true);

    playback.playLine(1);
    expect(playback.inGap()).toBe(false);
  });

  it('resumes the loop instead when playback is running', async () => {
    const { playback, practice } = setup(1000);
    playback.play();
    await vi.advanceTimersByTimeAsync(100);

    playback.playLine(2);
    expect(practice.index()).toBe(2);
    expect(practice.playing()).toBe(true);
  });
});

describe('PlaybackService validation timing', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('opens validation only after the audio when spelling is off', async () => {
    const { playback, speaker } = setup(1000);
    const openedAfter: number[] = [];
    playback.setValidationHook(() => {
      openedAfter.push(speaker.spoken.length);
      return new Promise<void>(() => {});
    });

    playback.play();
    await vi.advanceTimersByTimeAsync(500);
    expect(openedAfter).toEqual([]);

    await vi.advanceTimersByTimeAsync(500);
    expect(openedAfter).toEqual([1]);
  });

  it('opens validation as the audio starts when spelling is on', async () => {
    const { playback, speaker } = setup(1000);
    const openedAfter: number[] = [];
    playback.setValidationTiming(() => true);
    playback.setValidationHook(() => {
      openedAfter.push(speaker.spoken.length);
      return new Promise<void>(() => {});
    });

    playback.play();
    await vi.advanceTimersByTimeAsync(0);

    expect(openedAfter).toEqual([0]);
  });

  it('accepts an answer typed while the audio is still playing', async () => {
    const { playback, practice } = setup(1000);
    let release!: () => void;
    playback.setValidationTiming(() => true);
    playback.setValidationHook(() => new Promise<void>((r) => { release = r; }));

    playback.play();
    await vi.advanceTimersByTimeAsync(200);
    release();

    await vi.advanceTimersByTimeAsync(800);
    await vi.advanceTimersByTimeAsync(0);
    expect(practice.index()).toBe(1);
  });

  it('closes a box it opened early when the session runs out during the audio', async () => {
    const { playback, settings, timer } = setup(70_000);
    const aborted = vi.fn();
    playback.setValidationTiming(() => true);
    playback.setValidationHook(() => new Promise<void>(() => {}));
    playback.setValidationAbort(aborted);

    settings.setDurationMin(1);
    timer.reset(1);

    playback.play();
    await vi.advanceTimersByTimeAsync(70_000);

    expect(aborted).toHaveBeenCalled();
  });

  it('closes a box it opened early when playback is stopped mid-audio', async () => {
    const { playback } = setup(1000);
    const aborted = vi.fn();
    playback.setValidationTiming(() => true);
    playback.setValidationHook(() => new Promise<void>(() => {}));
    playback.setValidationAbort(aborted);

    playback.play();
    await vi.advanceTimersByTimeAsync(200);
    playback.pause();
    await vi.advanceTimersByTimeAsync(1000);

    expect(aborted).toHaveBeenCalled();
  });
});
