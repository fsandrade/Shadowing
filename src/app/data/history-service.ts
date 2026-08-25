import { inject, Injectable } from '@angular/core';
import { AuthStore } from '../platform/auth';
import { SUPABASE } from '../platform/supabase-client';

export interface AccumulatedProgress {
  readonly currentStreak: number;
  readonly longestStreak: number;
}

export interface DayTotals {
  readonly practisedMs: number;
  readonly sentencesPractised: number;
  readonly sentencesDistinct: number;
  // Null, not zero, when nothing was scored: unscored practice earns no stars,
  // and "0.0 per sentence" would read as a bad result rather than no result.
  readonly averageStars: number | null;
}

export interface PracticeTotals extends DayTotals {
  readonly currentStreak: number;
  readonly longestStreak: number;
  readonly daysStudied: number;
  readonly today: DayTotals;
}

function count(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function average(stars: unknown, sentences: unknown): number | null {
  const n = count(sentences);
  if (n === 0) { return null; }
  return Math.round((count(stars) / n) * 10) / 10;
}

// Progress that outlives one session. Read only where it is shown - the
// summary screen - so a learner who never finishes an activity never pays for
// the query. Every failure returns null and the summary omits the section:
// nothing here is worth blocking or breaking the screen over.
@Injectable({ providedIn: 'root' })
export class HistoryService {
  private readonly client = inject(SUPABASE);
  private readonly auth = inject(AuthStore);

  // Everything the chooser's two panels show, in one row. Days and minutes
  // count every activity; sentence and star figures count only scored
  // attempts, because unscored practice produces none.
  async totals(): Promise<PracticeTotals | null> {
    const userId = this.auth.userId();
    if (!userId) { return null; }

    try {
      const { data, error } = await this.client
        .from('user_practice_totals')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) { return null; }

      return {
        currentStreak: count(data?.['current_streak']),
        longestStreak: count(data?.['longest_streak']),
        daysStudied: count(data?.['days_studied']),
        practisedMs: count(data?.['practised_ms']),
        sentencesPractised: count(data?.['sentences_practised']),
        sentencesDistinct: count(data?.['sentences_distinct']),
        averageStars: average(data?.['stars_earned'], data?.['sentences_practised']),
        today: {
          practisedMs: count(data?.['today_practised_ms']),
          sentencesPractised: count(data?.['today_sentences_practised']),
          sentencesDistinct: count(data?.['today_sentences_distinct']),
          averageStars: average(
            data?.['today_stars_earned'], data?.['today_sentences_practised'],
          ),
        },
      };
    } catch {
      return null;
    }
  }

  async accumulated(): Promise<AccumulatedProgress | null> {
    const userId = this.auth.userId();
    if (!userId) { return null; }

    try {
      const { data, error } = await this.client
        .from('user_streaks')
        .select('current_streak, longest_streak')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) { return null; }

      return {
        currentStreak: count(data?.['current_streak']),
        longestStreak: count(data?.['longest_streak']),
      };
    } catch {
      return null;
    }
  }
}
