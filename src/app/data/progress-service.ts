import { inject, Injectable, InjectionToken } from '@angular/core';
import type { PracticeKind } from '../core/activity';
import {
  type AttemptCounts, similarityFromCounts, speechCounts,
} from '../core/scoring';
import { typingCounts } from '../core/typing';
import { BannerStore } from '../state/banner-store';
import { MESSAGES } from '../state/messages';
import { SettingsStore } from '../state/settings-store';
import type { SentenceIds } from './corpus-source';
import { HistoryService } from './history-service';
import { ProgressStorage } from './progress-storage';

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

function uuid(): string {
  return crypto.randomUUID();
}

@Injectable({ providedIn: 'root' })
export class ProgressService {
  private readonly settings = inject(SettingsStore);
  private readonly sentenceIds = inject(SENTENCE_IDS);
  private readonly history = inject(HistoryService);
  private readonly storage = inject(ProgressStorage);
  private readonly banner = inject(BannerStore);

  private sessionId: string | null = null;
  private sessionStartedAt = 0;

  startSession(activity: PracticeKind, topicId: string | null, minutes: number): void {
    void activity;
    void topicId;
    void minutes;

    this.endSession();
    this.sessionId = uuid();
    this.sessionStartedAt = Date.now();
  }

  record(attempt: Attempt): void {
    const sessionId = this.sessionId;
    if (!sessionId) { return; }

    const sentenceId = this.sentenceIds.get(attempt.line);
    if (!sentenceId) { return; }

    const counts = this.countsFor(attempt);
    const saved = this.storage.recordAttempt({
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
    });
    if (!saved) { this.showStorageFull(); }
    this.history.refresh();
  }

  endSession(practisedMs = 0): void {
    if (!this.sessionId) { return; }

    const ms = Math.max(0, Math.round(practisedMs));
    if (ms > 0 && !this.storage.addPractice(this.sessionStartedAt, ms)) {
      this.showStorageFull();
    }

    this.sessionId = null;
  }

  private showStorageFull(): void {
    this.banner.show(MESSAGES.storageFull, 'storage');
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
