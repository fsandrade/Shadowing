import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { Clock } from '../platform/clock';
import { SafeStorage } from '../platform/storage';
import { CATALOG } from './catalog-token';
import { PracticeStore } from './practice-store';
import { SessionTimerStore } from './session-timer-store';
import { SettingsStore } from './settings-store';
import { NO_SHUFFLE, signedOutBackend, storedProfile, TEST_CATALOG } from '../testing/catalog';
import { RANDOM } from '../platform/rng';

const DATA = TEST_CATALOG;

function setup() {
  let now = 1_000_000;
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      ...signedOutBackend(),
      {
        provide: SafeStorage,
        useValue: storedProfile() as unknown as SafeStorage,
      },
      { provide: CATALOG, useValue: DATA },
      { provide: RANDOM, useValue: NO_SHUFFLE },
      {
        provide: Clock,
        useValue: {
          now: () => now,
          ticks: () => now,
          wait: () => ({ done: Promise.resolve(), resolveNow: () => {} }),
        } as unknown as Clock,
      },
    ],
  });
  return {
    timer: TestBed.inject(SessionTimerStore),
    settings: TestBed.inject(SettingsStore),
    practice: TestBed.inject(PracticeStore),
    advance: (ms: number) => { now += ms; },
  };
}

describe('SessionTimerStore always counts down', () => {
  it('spends the time it is given', () => {
    const { timer, settings, practice, advance } = setup();
    settings.setDurationMin(5);
    timer.reset(5);
    expect(timer.remainingMs()).toBe(300_000);

    practice.setPlaying(true);
    timer.resume();
    advance(60_000);
    timer.accrue();

    expect(timer.remainingMs()).toBe(240_000);
    expect(timer.expired()).toBe(false);
  });

  it('expires once the time is gone', () => {
    const { timer, settings, practice, advance } = setup();
    settings.setDurationMin(5);
    timer.reset(5);

    practice.setPlaying(true);
    timer.resume();
    advance(300_001);
    timer.accrue();

    expect(timer.expired()).toBe(true);
  });
});

describe('SessionTimerStore in countdown mode', () => {
  it('counts a 5 minute session down', () => {
    const { timer, settings, practice, advance } = setup();
    settings.setDurationMin(5);
    timer.reset(5);
    expect(timer.clockText()).toBe('05:00');

    practice.setPlaying(true);
    timer.resume();
    advance(60_000);
    timer.tick();
    expect(timer.clockText()).toBe('04:00');
  });

  it('expires once the remaining time is exhausted', () => {
    const { timer, settings, practice, advance } = setup();
    settings.setDurationMin(1);
    timer.reset(1);
    practice.setPlaying(true);
    timer.resume();

    advance(59_000);
    expect(timer.expired()).toBe(false);
    advance(1_000);
    expect(timer.expired()).toBe(true);
  });

  it('banks the slice on pause so the paused clock does not drift', () => {
    const { timer, settings, practice, advance } = setup();
    settings.setDurationMin(5);
    timer.reset(5);

    practice.setPlaying(true);
    timer.resume();
    advance(30_000);

    timer.accrue();
    practice.setPlaying(false);

    advance(120_000);
    timer.tick();
    expect(timer.clockText()).toBe('04:30');
  });

  it('shows no live slice while paused, matching the vanilla elapsedNow gate', () => {
    const { timer, settings, advance } = setup();
    settings.setDurationMin(5);
    timer.reset(5);
    timer.resume();

    advance(30_000);
    timer.accrue();
    timer.tick();
    expect(timer.clockText()).toBe('05:00');
    expect(timer.remainingMs()).toBe(300_000);
  });

  it('finish returns the spoken count then resets both', () => {
    const { timer, settings } = setup();
    settings.setDurationMin(5);
    timer.reset(5);
    timer.countSpoken(0);
    timer.countSpoken(1);

    expect(timer.finish().spoken).toBe(2);
    expect(timer.spokenCount()).toBe(0);
    expect(timer.clockText()).toBe('05:00');
  });
});

describe('SessionTimerStore tally', () => {
  it('counts a sentence once however many times it is practised', () => {
    const { timer } = setup();
    timer.countSpoken(4);
    timer.countSpoken(4);
    timer.countSpoken(4);
    expect(timer.spokenCount()).toBe(1);
  });

  it('reports no stars until the validator scores something', () => {
    const { timer } = setup();
    timer.countSpoken(0);
    expect(timer.starsWon()).toBe(0);
    expect(timer.finish().stars).toBeNull();
  });

  it('adds up the stars across sentences', () => {
    const { timer } = setup();
    timer.countSpoken(0);
    timer.recordStars(0, 5);
    timer.countSpoken(1);
    timer.recordStars(1, 3);

    expect(timer.starsWon()).toBe(8);
    expect(timer.finish()).toEqual({ spoken: 2, stars: 8 });
  });

  it('keeps only the latest score for a repeated sentence', () => {
    const { timer } = setup();
    timer.countSpoken(0);
    timer.recordStars(0, 2);
    timer.recordStars(0, 3);
    timer.recordStars(0, 5);

    expect(timer.spokenCount()).toBe(1);
    expect(timer.starsWon()).toBe(5);
  });

  it('reports zero stars when a scored attempt found nothing', () => {
    const { timer } = setup();
    timer.countSpoken(0);
    timer.recordStars(0, 0);
    expect(timer.finish().stars).toBe(0);
  });

  it('ignores stars for a sentence the session never counted', () => {
    const { timer } = setup();
    timer.recordStars(7, 5);
    expect(timer.starsWon()).toBe(0);
    expect(timer.finish().stars).toBeNull();
  });

  it('clears both tallies on reset', () => {
    const { timer, settings } = setup();
    settings.setDurationMin(5);
    timer.countSpoken(0);
    timer.recordStars(0, 4);

    timer.reset(5);
    expect(timer.spokenCount()).toBe(0);
    expect(timer.starsWon()).toBe(0);
  });
});
