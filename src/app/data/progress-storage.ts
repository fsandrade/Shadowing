import { inject, Injectable } from '@angular/core';
import { localDay } from '../core/days';
import { nextMastery } from '../core/mastery';
import { MAX_STARS } from '../core/scoring';
import { SafeStorage } from '../platform/storage';

export const PROGRESS_KEY = 'shadowing.progress';
export const RECENT_ATTEMPTS_KEY = 'shadowing.attempts';
export const LEGACY_SESSIONS_KEY = 'shadowing.sessions';
export const RECENT_LIMIT = 200;

export interface StoredSentenceProgress {
  readonly bestStars: number;
  readonly lastStars: number;
  readonly lastAttemptedAt: number;
  readonly streak: number;
  readonly mastered: boolean;
}

export interface StoredDay {
  readonly practisedMs: number;
  readonly scoredAttempts: number;
  readonly starsSum: number;
  readonly sentenceIds: readonly string[];
}

export interface StoredProgress {
  readonly version: 3;
  readonly sentences: Readonly<Record<string, StoredSentenceProgress>>;
  readonly days: Readonly<Record<string, StoredDay>>;
}

export type StoredAttemptStatus = 'scored' | 'failed';
export type StoredPracticeMode = 'speech' | 'typing';

export interface StoredAttempt {
  readonly id: string;
  readonly sessionId: string;
  readonly sentenceId: string;
  readonly mode: StoredPracticeMode;
  readonly status: StoredAttemptStatus;
  readonly stars: number | null;
  readonly transcript: string;
  readonly targetWordCount: number;
  readonly matchedWordCount: number;
  readonly similarity: number;
  readonly attemptedAt: string;
}

export interface AttemptToStore {
  readonly sessionId: string;
  readonly sentenceId: string;
  readonly mode: StoredPracticeMode;
  readonly status: StoredAttemptStatus;
  readonly stars: number | null;
  readonly transcript: string;
  readonly targetWordCount: number;
  readonly matchedWordCount: number;
  readonly similarity: number;
  readonly attemptedAt: string;
}

type JsonRecord = Record<string, unknown>;

function emptyProgress(): StoredProgress {
  return { version: 3, sentences: {}, days: {} };
}

function count(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function record(value: unknown): JsonRecord | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as JsonRecord
    : null;
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function attemptTime(value: unknown): number {
  if (typeof value !== 'string') { return 0; }
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : 0;
}

function isStoredProgress(value: unknown): value is StoredProgress {
  const raw = record(value);
  return raw?.['version'] === 3
    && record(raw['sentences']) !== null
    && record(raw['days']) !== null;
}

function isVersion2Progress(value: unknown): boolean {
  const raw = record(value);
  return raw?.['version'] === 2
    && record(raw['sentences']) !== null
    && record(raw['days']) !== null;
}

function upgrade(value: unknown): StoredProgress {
  const raw = record(value) ?? {};
  const sentences: Record<string, StoredSentenceProgress> = {};
  for (const [id, entry] of Object.entries(record(raw['sentences']) ?? {})) {
    const old = record(entry);
    if (!old) { continue; }
    const bestStars = count(old['bestStars']);
    const lastStars = count(old['lastStars']);
    sentences[id] = {
      bestStars,
      lastStars,
      lastAttemptedAt: count(old['lastAttemptedAt']),
      streak: lastStars >= 4 ? 1 : 0,
      mastered: bestStars >= MAX_STARS,
    };
  }
  return {
    version: 3,
    sentences,
    days: (record(raw['days']) ?? {}) as StoredProgress['days'],
  };
}

function isStoredAttempt(value: unknown): value is StoredAttempt {
  const raw = record(value);
  return raw !== null
    && typeof raw['sentenceId'] === 'string'
    && raw['sentenceId'].length > 0
    && typeof raw['attemptedAt'] === 'string';
}

function updateSentence(
  sentences: Record<string, StoredSentenceProgress>,
  sentenceId: string,
  stars: number,
  at: number,
): void {
  const previous = sentences[sentenceId];
  const latest = !previous || at >= previous.lastAttemptedAt;
  const mastery = latest
    ? nextMastery(
      { streak: previous?.streak ?? 0, mastered: previous?.mastered ?? false },
      stars,
    )
    : { streak: previous!.streak, mastered: previous!.mastered };
  sentences[sentenceId] = {
    bestStars: Math.max(previous?.bestStars ?? 0, stars),
    lastStars: latest ? stars : previous!.lastStars,
    lastAttemptedAt: Math.max(previous?.lastAttemptedAt ?? 0, at),
    ...mastery,
  };
}

function updateDay(
  days: Record<string, StoredDay>,
  day: string,
  sentenceId: string,
  stars: number,
): void {
  const previous = days[day] ?? {
    practisedMs: 0,
    scoredAttempts: 0,
    starsSum: 0,
    sentenceIds: [],
  };
  days[day] = {
    practisedMs: previous.practisedMs,
    scoredAttempts: previous.scoredAttempts + 1,
    starsSum: previous.starsSum + stars,
    sentenceIds: previous.sentenceIds.includes(sentenceId)
      ? previous.sentenceIds
      : [...previous.sentenceIds, sentenceId],
  };
}

function addPracticeTime(days: Record<string, StoredDay>, at: number, practisedMs: number): void {
  const day = localDay(new Date(at));
  const previous = days[day] ?? {
    practisedMs: 0,
    scoredAttempts: 0,
    starsSum: 0,
    sentenceIds: [],
  };
  days[day] = {
    ...previous,
    practisedMs: previous.practisedMs + Math.max(0, Math.round(practisedMs)),
  };
}

function migrate(attempts: readonly unknown[], sessions: readonly unknown[]): StoredProgress {
  const sentences: Record<string, StoredSentenceProgress> = {};
  const days: Record<string, StoredDay> = {};

  for (const value of attempts) {
    const raw = record(value);
    if (!raw) { continue; }
    const sentenceId = raw['sentenceId'];
    if (typeof sentenceId !== 'string' || !sentenceId) { continue; }

    const stars = count(raw['stars']);
    const at = attemptTime(raw['attemptedAt']);
    updateSentence(sentences, sentenceId, stars, at);

    if (raw['status'] === 'scored') {
      updateDay(days, localDay(new Date(at)), sentenceId, stars);
    }
  }

  for (const value of sessions) {
    const raw = record(value);
    if (!raw) { continue; }
    const practisedMs = count(raw['practisedMs']);
    if (practisedMs <= 0) { continue; }
    addPracticeTime(days, attemptTime(raw['startedAt']), practisedMs);
  }

  return { version: 3, sentences, days };
}

@Injectable({ providedIn: 'root' })
export class ProgressStorage {
  private readonly storage = inject(SafeStorage);

  read(): StoredProgress {
    const stored = this.storage.read<unknown>(PROGRESS_KEY);
    if (isStoredProgress(stored)) { return stored; }
    if (isVersion2Progress(stored)) {
      const upgraded = upgrade(stored);
      this.storage.write(PROGRESS_KEY, upgraded);
      return upgraded;
    }

    const attempts = array(this.storage.read<unknown>(RECENT_ATTEMPTS_KEY));
    const sessions = array(this.storage.read<unknown>(LEGACY_SESSIONS_KEY));
    if (!attempts.length && !sessions.length) { return emptyProgress(); }

    const progress = migrate(attempts, sessions);
    const saved = this.storage.write(PROGRESS_KEY, progress);
    if (saved !== false) {
      this.storage.write(RECENT_ATTEMPTS_KEY, attempts.slice(-RECENT_LIMIT));
      this.storage.remove(LEGACY_SESSIONS_KEY);
    }
    return progress;
  }

  readRecent(): StoredAttempt[] {
    const raw = this.storage.read<unknown>(RECENT_ATTEMPTS_KEY);
    if (!Array.isArray(raw)) { return []; }
    return raw.filter(isStoredAttempt).slice(-RECENT_LIMIT);
  }

  recordAttempt(attempt: AttemptToStore): boolean {
    const progress = this.read();
    const sentences = { ...progress.sentences };
    const days = { ...progress.days };
    const stars = count(attempt.stars);
    const at = attemptTime(attempt.attemptedAt);

    updateSentence(sentences, attempt.sentenceId, stars, at);
    if (attempt.status === 'scored') {
      updateDay(days, localDay(new Date(at)), attempt.sentenceId, stars);
    }

    const saved = this.storage.write(PROGRESS_KEY, { version: 3, sentences, days });
    const recent = this.readRecent();
    recent.push({
      ...attempt,
      id: crypto.randomUUID(),
    });
    this.storage.write(RECENT_ATTEMPTS_KEY, recent.slice(-RECENT_LIMIT));
    return saved !== false;
  }

  addPractice(startedAt: number, practisedMs: number): boolean {
    const progress = this.read();
    const days = { ...progress.days };
    addPracticeTime(days, startedAt, practisedMs);
    const saved = this.storage.write(PROGRESS_KEY, {
      version: 3,
      sentences: progress.sentences,
      days,
    });
    return saved !== false;
  }
}
