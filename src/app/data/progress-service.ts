import { inject, Injectable, InjectionToken } from '@angular/core';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ActivityId } from '../core/activity';
import {
  type AttemptCounts, similarityFromCounts, speechCounts,
} from '../core/scoring';
import { typingCounts } from '../core/typing';
import { AuthStore } from '../platform/auth';
import { SUPABASE } from '../platform/supabase-client';
import { SettingsStore } from '../state/settings-store';
import { AttemptQueue, type Pending } from './attempt-queue';
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

const RETRYABLE_4XX = new Set([408, 425, 429]);

function isPermanent(status: number): boolean {
  return status >= 400 && status < 500 && !RETRYABLE_4XX.has(status);
}

function uuid(): string {
  return crypto.randomUUID();
}

@Injectable({ providedIn: 'root' })
export class ProgressService {
  private readonly client = inject(SUPABASE);
  private readonly auth = inject(AuthStore);
  private readonly settings = inject(SettingsStore);
  private readonly queue = inject(AttemptQueue);
  private readonly sentenceIds = inject(SENTENCE_IDS);

  private sessionId: string | null = null;
  private sessionStartedAt = 0;
  private draining: Promise<void> | null = null;
  private queuedWhileDraining = false;

  startSession(
    activity: Exclude<ActivityId, 'custom'>,
    topicId: string | null,
    minutes: number,
  ): void {
    // Whatever was running is over the moment a new activity begins.
    this.endSession();

    const userId = this.auth.userId();
    if (!userId) { return; }

    this.sessionId = uuid();
    this.sessionStartedAt = Date.now();

    this.enqueue({
      kind: 'session',
      userId,
      row: {
        id: this.sessionId,
        user_id: userId,
        deck_id: topicId,
        activity,
        started_at: new Date(this.sessionStartedAt).toISOString(),
        planned_duration_min: minutes,
      },
    });
  }

  record(attempt: Attempt): void {
    const userId = this.auth.userId();
    if (!userId) { return; }

    // Every practice run opens a session first. An attempt without one means
    // the client is in a state we did not design; writing it with a null
    // session_id would silently skew the per-session rollups.
    const sessionId = this.sessionId;
    if (!sessionId) { return; }

    const sentenceId = this.sentenceIds.get(attempt.line);
    if (!sentenceId) { return; }

    const counts = this.countsFor(attempt);
    const row = {
      id: uuid(),
      user_id: userId,
      session_id: sessionId,
      sentence_id: sentenceId,
      mode: this.mode(),
      status: attempt.status,
      stars: attempt.stars,
      transcript: attempt.transcript,
      target_word_count: counts.targetLength,
      matched_word_count: counts.matched,
      similarity: Number(similarityFromCounts(counts).toFixed(4)),
      attempted_at: new Date().toISOString(),
    };

    this.enqueue({ kind: 'attempt', userId, row });
  }

  endSession(): void {
    const userId = this.auth.userId();
    if (!userId || !this.sessionId) { return; }

    this.enqueue({
      kind: 'session-end',
      userId,
      row: {
        id: this.sessionId,
        ended_at: new Date().toISOString(),
        elapsed_ms: Math.max(0, Date.now() - this.sessionStartedAt),
      },
    });

    this.sessionId = null;
  }

  flush(): void {
    void this.drain();
  }

  private mode(): PracticeMode {
    return this.settings.typingMode() ? 'typing' : 'speech';
  }

  private countsFor(attempt: Attempt): AttemptCounts {
    return this.mode() === 'typing'
      ? typingCounts(attempt.baseText, attempt.transcript)
      : speechCounts(attempt.baseText, attempt.transcript);
  }

  private enqueue(entry: Pending): void {
    this.queue.add(entry);
    void this.drain();
  }

  private drain(): Promise<void> {
    if (this.draining) {
      this.queuedWhileDraining = true;
      return this.draining;
    }
    this.draining = this.drainLoop().finally(() => { this.draining = null; });
    return this.draining;
  }

  private async drainLoop(): Promise<void> {
    do {
      this.queuedWhileDraining = false;
      await this.drainOnce();
    } while (this.queuedWhileDraining);
  }

  private async drainOnce(): Promise<void> {
    const pending = this.queue.read();
    if (!pending.length) { return; }

    const currentUser = this.auth.userId();
    let i = 0;

    for (; i < pending.length; i++) {
      const entry = pending[i];

      if (entry.userId !== currentUser) { continue; }

      const status = await this.send(entry);
      if (status === 'retry') { break; }
    }

    this.queue.write(this.queue.read().slice(i));
  }

  private async send(entry: Pending): Promise<'done' | 'retry'> {
    try {
      const { error, status } = entry.kind === 'session-end'
        ? await this.client
          .from('practice_sessions')
          .update({ ended_at: entry.row['ended_at'], elapsed_ms: entry.row['elapsed_ms'] })
          .eq('id', entry.row['id'])

        : await this.client
          .from(entry.kind === 'session' ? 'practice_sessions' : 'sentence_attempts')
          .insert(entry.row);

      if (!error) { return 'done'; }
      if (isPermanent(status)) {
        console.warn(`Dropping unsendable progress (${status}): ${error.message}`);
        return 'done';
      }
      return 'retry';
    } catch {
      return 'retry';
    }
  }
}
