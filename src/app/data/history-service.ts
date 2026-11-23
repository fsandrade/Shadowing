import { inject, Injectable, signal } from '@angular/core';
import type { SentenceProgress } from '../core/progression';

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

const SESSIONS_KEY = 'shadowing.sessions';
const ATTEMPTS_KEY = 'shadowing.attempts';

type JsonRecord = Record<string, unknown>;

function count(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function average(stars: unknown, sentences: unknown): number | null {
  const n = count(sentences);
  if (n === 0) { return null; }
  return Math.round((count(stars) / n) * 10) / 10;
}

function readStore(key: string): JsonRecord[] {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null || raw === undefined) { return []; }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed as JsonRecord[] : [];
  } catch {
    return [];
  }
}

function dayOf(iso: string | null | undefined): Date | null {
  if (!iso) { return null; }
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}


function localDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}




function streaks(days: string[]): { current: number; longest: number } {
  const sorted = [...days].sort();
  const runs: Array<{ endedOn: string; length: number }> = [];
  let runStart = 0;
  for (let i = 1; i <= sorted.length; i++) {
    if (i === sorted.length || !isConsecutive(sorted[i - 1], sorted[i])) {
      runs.push({ endedOn: sorted[i - 1], length: i - runStart });
      runStart = i;
    }
  }
  const today = localDay(new Date());
  const yesterday = localDay(new Date(Date.now() - 86_400_000));
  const current = runs.length
    ? (runs[runs.length - 1].endedOn === today || runs[runs.length - 1].endedOn === yesterday)
      ? runs[runs.length - 1].length
      : 0
    : 0;
  const longest = runs.reduce((m, r) => Math.max(m, r.length), 0);
  return { current, longest };
}

function isConsecutive(a: string, b: string): boolean {
  const da = new Date(a + 'T00:00:00Z');
  const db = new Date(b + 'T00:00:00Z');
  return (db.getTime() - da.getTime()) === 86_400_000;
}

function sentenceProgress(attempts: JsonRecord[]): Map<string, SentenceProgress> {
  const map = new Map<string, SentenceProgress>();

  for (const attempt of attempts) {
    const sentenceId = attempt['sentenceId'];
    if (typeof sentenceId !== 'string' || !sentenceId) { continue; }

    const stars = count(attempt['stars']);
    const at = dayOf(attempt['attemptedAt'] as string | null)?.getTime() ?? 0;
    const previous = map.get(sentenceId);
    const latest = !previous || at >= previous.lastAttemptedAt;

    map.set(sentenceId, {
      bestStars: Math.max(previous?.bestStars ?? 0, stars),
      lastStars: latest ? stars : previous!.lastStars,
      lastAttemptedAt: Math.max(previous?.lastAttemptedAt ?? 0, at),
    });
  }

  return map;
}

@Injectable({ providedIn: 'root' })
export class HistoryService {
  readonly progress = signal<ReadonlyMap<string, SentenceProgress>>(new Map());

  constructor() {
    this.refresh();
  }

  refresh(): void {
    this.progress.set(sentenceProgress(readStore(ATTEMPTS_KEY)));
  }

  
  
  
  
  totals(): PracticeTotals | null {
    const sessions = readStore(SESSIONS_KEY);
    const attempts = readStore(ATTEMPTS_KEY);

    if (!sessions.length && !attempts.length) { return null; }

    const practisedSessions = sessions.filter((s) => count(s['practisedMs']) > 0);
    const practisedDays = Array.from(new Set(
      practisedSessions.map((s) => localDay(dayOf(s['startedAt'] as string | null) ?? new Date(0))),
    ));

    const scored = attempts.filter((a) => a['status'] === 'scored');
    const starsSum = scored.reduce((sum, a) => sum + count(a['stars']), 0);

    const { current, longest } = streaks(practisedDays);

    const today = localDay(new Date());
    const todaySessions = practisedSessions.filter((s) => localDay(dayOf(s['startedAt'] as string | null) ?? new Date(0)) === today);
    const todayAttempts = scored.filter((a) => localDay(new Date(a['attemptedAt'] as string)) === today);

    return {
      currentStreak: current,
      longestStreak: longest,
      daysStudied: practisedDays.length,
      practisedMs: practisedSessions.reduce((sum, s) => sum + count(s['practisedMs']), 0),
      sentencesPractised: scored.length,
      sentencesDistinct: Array.from(new Set(scored.map((a) => a['sentenceId'] as string))).length,
      averageStars: average(starsSum, scored.length),
      today: {
        practisedMs: todaySessions.reduce((sum, s) => sum + count(s['practisedMs']), 0),
        sentencesPractised: todayAttempts.length,
        sentencesDistinct: Array.from(new Set(todayAttempts.map((a) => a['sentenceId'] as string))).length,
        averageStars: average(
          todayAttempts.reduce((sum, a) => sum + count(a['stars']), 0),
          todayAttempts.length,
        ),
      },
    };
  }

  accumulated(): AccumulatedProgress | null {
    const sessions = readStore(SESSIONS_KEY);
    const practisedSessions = sessions.filter((s) => count(s['practisedMs']) > 0);
    if (!practisedSessions.length) { return null; }

    const practisedDays = Array.from(new Set(
      practisedSessions.map((s) => localDay(dayOf(s['startedAt'] as string | null) ?? new Date(0))),
    ));
    const { current, longest } = streaks(practisedDays);
    return { currentStreak: current, longestStreak: longest };
  }
}
