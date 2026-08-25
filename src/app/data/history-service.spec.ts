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

    });

    expect(await history.accumulated()).toEqual({
      currentStreak: 4,
      longestStreak: 11,
    });
  });

  it('reads zeroes for a learner with no history yet, rather than failing', async () => {
    const { history } = setup({ streaks: null, level: null });
    expect(await history.accumulated()).toEqual({
      currentStreak: 0,
      longestStreak: 0,
    });
  });

  it('returns nothing with nobody signed in, without touching the network', async () => {
    const { history, asked } = setup({ userId: null });
    expect(await history.accumulated()).toBeNull();
    expect(asked).toEqual([]);
  });

  it('returns nothing when the read fails, so the summary can just omit the section', async () => {
    const { history } = setup({ fails: true });
    expect(await history.accumulated()).toBeNull();
  });
});

describe('HistoryService totals', () => {
  function totalsSetup(opts: { row?: Record<string, unknown> | null; fails?: boolean;
    userId?: string | null } = {}) {
    const asked: string[] = [];
    const client = {
      from: (table: string) => {
        asked.push(table);
        const reply = Promise.resolve(
          opts.fails
            ? { data: null, error: { message: 'nope' } }
            : { data: opts.row === undefined ? {} : opts.row, error: null },
        );
        return { select: () => ({ eq: () => ({ maybeSingle: () => reply }) }) };
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

  it('reads both scopes in one query', async () => {
    const { history, asked } = totalsSetup({
      row: {
        current_streak: 12, longest_streak: 20, days_studied: 47,
        practised_ms: 22_800_000, sentences_practised: 1312,
        sentences_distinct: 431, stars_earned: 4986,
        today_practised_ms: 840_000, today_sentences_practised: 38,
        today_sentences_distinct: 22, today_stars_earned: 156,
      },
    });

    const totals = await history.totals();

    expect(asked).toEqual(['user_practice_totals']);
    expect(totals).toEqual({
      currentStreak: 12,
      longestStreak: 20,
      daysStudied: 47,
      practisedMs: 22_800_000,
      sentencesPractised: 1312,
      sentencesDistinct: 431,
      averageStars: 3.8,
      today: {
        practisedMs: 840_000,
        sentencesPractised: 38,
        sentencesDistinct: 22,
        averageStars: 4.1,
      },
    });
  });

  it('reports no average rather than zero when nothing was scored', async () => {
    const { history } = totalsSetup({
      row: {
        current_streak: 3, days_studied: 3, practised_ms: 900_000,
        sentences_practised: 0, stars_earned: 0,
        today_practised_ms: 300_000, today_sentences_practised: 0,
      },
    });

    const totals = await history.totals();

    // A week of Listening has minutes and days but nothing marked. Zero stars
    // per sentence would be a judgement; no average is the truth.
    expect(totals?.averageStars).toBeNull();
    expect(totals?.today.averageStars).toBeNull();
    expect(totals?.daysStudied).toBe(3);
  });

  it('reads zeroes for a learner with no history at all', async () => {
    const { history } = totalsSetup({ row: null });
    const totals = await history.totals();
    expect(totals?.daysStudied).toBe(0);
    expect(totals?.averageStars).toBeNull();
  });

  it('returns nothing with nobody signed in, without touching the network', async () => {
    const { history, asked } = totalsSetup({ userId: null });
    expect(await history.totals()).toBeNull();
    expect(asked).toEqual([]);
  });

  it('returns nothing when the read fails, so the panels can just be absent', async () => {
    const { history } = totalsSetup({ fails: true });
    expect(await history.totals()).toBeNull();
  });
});
