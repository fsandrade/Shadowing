import { inject, Injectable, InjectionToken } from '@angular/core';
import type { PracticeKind } from '../core/activity';
import {
  type AttemptCounts, similarityFromCounts, speechCounts,
} from '../core/scoring';
import { typingCounts } from '../core/typing';
import { SettingsStore } from '../state/settings-store';
import type { SentenceIds } from './corpus-source';

export const SENTENCE_IDS = new InjectionToken<SentenceIds>('SENTENCE_IDS');

export type PracticeMode = 'speech' | 'typing';
export type AttemptStatus = 'scored' | 'failed';

export interface Attempt {
  readonly line: string;
  readonly baseText: string;
  readonly transcript: string;
  readonly stars: number | null;
  readonly status: AttemptStatus;
}

const SESSIONS_KEY = 'shadowing.sessions';
const ATTEMPTS_KEY = 'shadowing.attempts';

type JsonRecord = Record<string, unknown>;

function uuid(): string {
  return crypto.randomUUID();
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

function writeStore<T>(key: string, value: T[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    
  }
}

@Injectable({ providedIn: 'root' })
export class ProgressService {
  private readonly settings = inject(SettingsStore);
  private readonly sentenceIds = inject(SENTENCE_IDS);

  private sessionId: string | null = null;
  private sessionStartedAt = 0;

  startSession(activity: PracticeKind, topicId: string | null, minutes: number): void {
    
    this.endSession();

    this.sessionId = uuid();
    this.sessionStartedAt = Date.now();

    const session = {
      id: this.sessionId,
      activity,
      deckId: topicId,
      startedAt: new Date(this.sessionStartedAt).toISOString(),
      plannedDurationMin: minutes,
      endedAt: null,
      elapsedMs: 0,
      practisedMs: 0,
      sentencesPracticed: 0,
      starsEarned: 0,
    };
    writeStore(SESSIONS_KEY, [...readStore(SESSIONS_KEY), session]);
  }

  record(attempt: Attempt): void {
    const sessionId = this.sessionId;
    if (!sessionId) { return; }

    const sentenceId = this.sentenceIds.get(attempt.line);
    if (!sentenceId) { return; }

    const counts = this.countsFor(attempt);
    const record = {
      id: uuid(),
      sessionId,
      sentenceId,
      mode: this.mode(),
      status: attempt.status,
      stars: attempt.stars,
      transcript: attempt.transcript,
      targetWordCount: counts.targetLength,
      matchedWordCount: counts.matched,
      similarity: Number(similarityFromCounts(counts).toFixed(4)),
      attemptedAt: new Date().toISOString(),
    };
    writeStore(ATTEMPTS_KEY, [...readStore(ATTEMPTS_KEY), record]);
  }

  
  
  endSession(practisedMs = 0): void {
    if (!this.sessionId) { return; }

    writeStore(SESSIONS_KEY, readStore(SESSIONS_KEY).map((s) =>
      s['id'] === this.sessionId
        ? {
          ...s,
          endedAt: new Date().toISOString(),
          elapsedMs: Math.max(0, Date.now() - this.sessionStartedAt),
          practisedMs: Math.max(0, Math.round(practisedMs)),
        }
        : s
    ));

    this.sessionId = null;
  }

  flush(): void {
    
  }

  private mode(): PracticeMode {
    return this.settings.typingMode() ? 'typing' : 'speech';
  }

  private countsFor(attempt: Attempt): AttemptCounts {
    return this.mode() === 'typing'
      ? typingCounts(attempt.baseText, attempt.transcript)
      : speechCounts(attempt.baseText, attempt.transcript);
  }
}
