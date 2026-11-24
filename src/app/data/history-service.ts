import { inject, Injectable, signal } from '@angular/core';
import { localDay, streaks } from '../core/days';
import type { SentenceProgress } from '../core/progression';
import { type StoredDay, ProgressStorage } from './progress-storage';

export interface AccumulatedProgress {
  readonly currentStreak: number;
  readonly longestStreak: number;
}

export interface DayTotals {
  readonly practisedMs: number;
  readonly sentencesPractised: number;
  readonly sentencesDistinct: number;
  readonly averageStars: number | null;
}

export interface PracticeTotals extends DayTotals {
  readonly currentStreak: number;
  readonly longestStreak: number;
  readonly daysStudied: number;
  readonly today: DayTotals;
}

const EMPTY_DAY: StoredDay = {
  practisedMs: 0,
  scoredAttempts: 0,
  starsSum: 0,
  sentenceIds: [],
};

function average(stars: number, sentences: number): number | null {
  if (sentences === 0) { return null; }
  return Math.round((stars / sentences) * 10) / 10;
}

function dayTotals(day: StoredDay): DayTotals {
  return {
    practisedMs: day.practisedMs,
    sentencesPractised: day.scoredAttempts,
    sentencesDistinct: day.sentenceIds.length,
    averageStars: average(day.starsSum, day.scoredAttempts),
  };
}

@Injectable({ providedIn: 'root' })
export class HistoryService {
  private readonly storage = inject(ProgressStorage);

  readonly progress = signal<ReadonlyMap<string, SentenceProgress>>(new Map());

  constructor() {
    this.refresh();
  }

  refresh(): void {
    const data = this.storage.read();
    this.progress.set(new Map(Object.entries(data.sentences)));
  }

  totals(): PracticeTotals | null {
    const data = this.storage.read();
    const entries = Object.entries(data.days);
    if (!entries.length && !Object.keys(data.sentences).length) { return null; }

    const practisedDays = entries
      .filter(([, day]) => day.practisedMs > 0)
      .map(([day]) => day);
    const scoredDays = entries;
    const scoredAttempts = scoredDays.reduce((sum, [, day]) => sum + day.scoredAttempts, 0);
    const starsSum = scoredDays.reduce((sum, [, day]) => sum + day.starsSum, 0);
    const distinct = new Set(scoredDays.flatMap(([, day]) => day.sentenceIds)).size;
    const { current, longest } = streaks(practisedDays);
    const today = dayTotals(data.days[localDay(new Date())] ?? EMPTY_DAY);

    return {
      currentStreak: current,
      longestStreak: longest,
      daysStudied: practisedDays.length,
      practisedMs: entries.reduce((sum, [, day]) => sum + day.practisedMs, 0),
      sentencesPractised: scoredAttempts,
      sentencesDistinct: distinct,
      averageStars: average(starsSum, scoredAttempts),
      today,
    };
  }

  accumulated(): AccumulatedProgress | null {
    const data = this.storage.read();
    const practisedDays = Object.entries(data.days)
      .filter(([, day]) => day.practisedMs > 0)
      .map(([day]) => day);
    if (!practisedDays.length) { return null; }

    const { current, longest } = streaks(practisedDays);
    return { currentStreak: current, longestStreak: longest };
  }
}
