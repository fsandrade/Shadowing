import { TestBed } from '@angular/core/testing';
import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { INITIAL_USER } from '../platform/auth';
import { SUPABASE } from '../platform/supabase-client';
import { HistoryService } from './history-service';

const USER = '11111111-1111-4111-8111-111111111111';

function setup(opts: {
  streaks?: Record<string, unknown> | null;
  level?: Record<string, unknown> | null;
  fails?: boolean;
  userId?: string | null;
} = {}) {
  const asked: string[] = [];
  const client = {
    from: (table: string) => {
      asked.push(table);
      const data = table === 'user_streaks' ? (opts.streaks ?? null) : (opts.level ?? null);
      const reply = Promise.resolve(
        opts.fails ? { data: null, error: { message: 'nope' } } : { data, error: null },
      );
      const eq = () => ({ eq: () => ({ maybeSingle: () => reply }), maybeSingle: () => reply });
      return { select: () => ({ eq }) };
    },
  } as unknown as SupabaseClient;

  const userId = opts.userId === undefined ? USER : opts.userId;

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: SUPABASE, useValue: client },
      {
        provide: INITIAL_USER,
        useValue: userId === null ? null : { id: userId, is_anonymous: true, user_metadata: {} },
      },
    ],
  });

  return { history: TestBed.inject(HistoryService), asked };
}

describe('HistoryService', () => {
  it('reports the streak and the level progress together', async () => {
    const { history } = setup({
      streaks: { current_streak: 4, longest_streak: 11 },
      level: { sentences_mastered: 30, sentences_attempted: 80, sentences_total: 200 },
    });

    expect(await history.accumulated('B1')).toEqual({
      currentStreak: 4,
      longestStreak: 11,
      sentencesMastered: 30,
      sentencesAttempted: 80,
      sentencesTotal: 200,
    });
  });

  it('reads zeroes for a learner with no history yet, rather than failing', async () => {
    const { history } = setup({ streaks: null, level: null });
    expect(await history.accumulated('B1')).toEqual({
      currentStreak: 0,
      longestStreak: 0,
      sentencesMastered: 0,
      sentencesAttempted: 0,
      sentencesTotal: 0,
    });
  });

  it('returns nothing with nobody signed in, without touching the network', async () => {
    const { history, asked } = setup({ userId: null });
    expect(await history.accumulated('B1')).toBeNull();
    expect(asked).toEqual([]);
  });

  it('returns nothing when the read fails, so the summary can just omit the section', async () => {
    const { history } = setup({ fails: true });
    expect(await history.accumulated('B1')).toBeNull();
  });
});
