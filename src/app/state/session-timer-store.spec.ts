import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { type Corpus } from '../core/deck';
import { Clock } from '../platform/clock';
import { SafeStorage } from '../platform/storage';
import { CORPUS_DATA } from './corpus-token';
import { PracticeStore } from './practice-store';
import { SessionTimerStore } from './session-timer-store';
import { SettingsStore } from './settings-store';

const DATA: Corpus = {
  generatedAt: '2026-08-06T00:00:00Z',
  decks: [{ id: 'a', name: 'A', lines: ['one', 'two'] }],
};

function setup() {
  let now = 1_000_000;
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      {
        provide: SafeStorage,
        useValue: { read: () => null, write: () => {} } as unknown as SafeStorage,
      },
      { provide: CORPUS_DATA, useValue: DATA },
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

describe('SessionTimerStore in count-up mode (no limit)', () => {
  it('starts at 00:00 and counts elapsed time up', () => {
    const { timer, practice, advance } = setup();
    expect(timer.clockText()).toBe('00:00');

    practice.setPlaying(true);
    timer.resume();
    advance(65_000);
    timer.tick();
    expect(timer.clockText()).toBe('01:05');
  });

  it('never expires', () => {
    const { timer, practice, advance } = setup();
    practice.setPlaying(true);
    timer.resume();
    advance(60 * 60_000);
    expect(timer.expired()).toBe(false);
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
    timer.countSpoken();
    timer.countSpoken();

    expect(timer.finish()).toBe(2);
    expect(timer.spokenCount()).toBe(0);
    expect(timer.clockText()).toBe('05:00');
  });
});
