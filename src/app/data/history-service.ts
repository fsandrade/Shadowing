import { inject, Injectable } from '@angular/core';
import { AuthStore } from '../platform/auth';
import { SUPABASE } from '../platform/supabase-client';

export interface AccumulatedProgress {
  readonly currentStreak: number;
  readonly longestStreak: number;
  readonly sentencesMastered: number;
  readonly sentencesAttempted: number;
  readonly sentencesTotal: number;
}

function count(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

// Progress that outlives one session. Read only where it is shown - the
// summary screen - so a learner who never finishes an activity never pays for
// the query. Every failure returns null and the summary omits the section:
// nothing here is worth blocking or breaking the screen over.
@Injectable({ providedIn: 'root' })
export class HistoryService {
  private readonly client = inject(SUPABASE);
  private readonly auth = inject(AuthStore);

  async accumulated(levelId: string | null): Promise<AccumulatedProgress | null> {
    const userId = this.auth.userId();
    if (!userId) { return null; }

    try {
      const [streaks, level] = await Promise.all([
        this.client
          .from('user_streaks')
          .select('current_streak, longest_streak')
          .eq('user_id', userId)
          .maybeSingle(),
        this.client
          .from('user_level_progress')
          .select('sentences_mastered, sentences_attempted, sentences_total')
          .eq('user_id', userId)
          .eq('level_id', levelId ?? '')
          .maybeSingle(),
      ]);

      if (streaks.error || level.error) { return null; }

      return {
        currentStreak: count(streaks.data?.['current_streak']),
        longestStreak: count(streaks.data?.['longest_streak']),
        sentencesMastered: count(level.data?.['sentences_mastered']),
        sentencesAttempted: count(level.data?.['sentences_attempted']),
        sentencesTotal: count(level.data?.['sentences_total']),
      };
    } catch {
      return null;
    }
  }
}
