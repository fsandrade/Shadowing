import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { HistoryService } from './history-service';

function storageKeys() {
  return Object.keys(localStorage).filter((k) => k.startsWith('shadowing.'));
}

beforeEach(() => {
  for (const key of storageKeys()) { localStorage.removeItem(key); }
});

describe('HistoryService', () => {
  it('returns null with no stored progress', () => {
    const history = TestBed.inject(HistoryService);
    expect(history.totals()).toBeNull();
    expect(history.accumulated()).toBeNull();
  });

  it('computes totals from stored sessions and attempts', () => {
    const today = new Date().toISOString();
    const yesterday = new Date(Date.now() - 86_400_000).toISOString();

    const sessions = [
      { id: 's1', activity: 'speaking', deckId: 'a', startedAt: today, endedAt: today,
        elapsedMs: 60000, practisedMs: 60000, plannedDurationMin: 10, sentencesPracticed: 2, starsEarned: 8 },
      { id: 's2', activity: 'speaking', deckId: 'a', startedAt: yesterday, endedAt: yesterday,
        elapsedMs: 30000, practisedMs: 30000, plannedDurationMin: 10, sentencesPracticed: 0, starsEarned: 0 },
    ];
    const attempts = [
      { id: 'a1', sessionId: 's1', sentenceId: 'sent-1', mode: 'speech', status: 'scored',
        stars: 5, transcript: 'hi', targetWordCount: 1, matchedWordCount: 1, similarity: 1, attemptedAt: today },
      { id: 'a2', sessionId: 's1', sentenceId: 'sent-2', mode: 'speech', status: 'scored',
        stars: 3, transcript: 'yo', targetWordCount: 1, matchedWordCount: 1, similarity: 1, attemptedAt: today },
      { id: 'a3', sessionId: 's1', sentenceId: 'sent-1', mode: 'speech', status: 'failed',
        stars: null, transcript: '', targetWordCount: 1, matchedWordCount: 0, similarity: 0, attemptedAt: today },
    ];
    localStorage.setItem('shadowing.sessions', JSON.stringify(sessions));
    localStorage.setItem('shadowing.attempts', JSON.stringify(attempts));

    const history = TestBed.inject(HistoryService);
    const totals = history.totals()!;
    const accumulated = history.accumulated()!;

    expect(totals.daysStudied).toBe(2);
    expect(totals.practisedMs).toBe(90000);
    expect(totals.sentencesPractised).toBe(2);
    expect(totals.sentencesDistinct).toBe(2);
    expect(totals.averageStars).toBe(4);
    expect(totals.currentStreak).toBe(2);
    expect(totals.longestStreak).toBe(2);
    expect(totals.today.sentencesPractised).toBe(2);
    expect(totals.today.practisedMs).toBe(60000);

    expect(accumulated.currentStreak).toBe(2);
    expect(accumulated.longestStreak).toBe(2);
  });
});

describe('HistoryService sentence progress', () => {
  it('summarises best stars, latest stars and latest time per sentence', () => {
    const older = new Date('2026-01-01T10:00:00Z').toISOString();
    const newer = new Date('2026-01-02T10:00:00Z').toISOString();
    localStorage.setItem('shadowing.attempts', JSON.stringify([
      { sentenceId: 's1', status: 'scored', stars: 3, attemptedAt: older },
      { sentenceId: 's1', status: 'scored', stars: 5, attemptedAt: newer },
      { sentenceId: 's2', status: 'scored', stars: 4, attemptedAt: newer },
      { sentenceId: 's2', status: 'failed', stars: null, attemptedAt: older },
    ]));

    const history = TestBed.inject(HistoryService);
    history.refresh();

    expect(history.progress().get('s1')).toEqual({
      bestStars: 5,
      lastStars: 5,
      lastAttemptedAt: Date.parse(newer),
    });
    expect(history.progress().get('s2')).toEqual({
      bestStars: 4,
      lastStars: 4,
      lastAttemptedAt: Date.parse(newer),
    });
  });

  it('counts a failed latest attempt as zero stars but keeps its time', () => {
    const older = new Date('2026-01-01T10:00:00Z').toISOString();
    const newer = new Date('2026-01-03T10:00:00Z').toISOString();
    localStorage.setItem('shadowing.attempts', JSON.stringify([
      { sentenceId: 's1', status: 'scored', stars: 4, attemptedAt: older },
      { sentenceId: 's1', status: 'failed', stars: null, attemptedAt: newer },
    ]));

    const history = TestBed.inject(HistoryService);
    history.refresh();

    expect(history.progress().get('s1')).toEqual({
      bestStars: 4,
      lastStars: 0,
      lastAttemptedAt: Date.parse(newer),
    });
  });

  it('refresh picks up attempts written after the service started', () => {
    const history = TestBed.inject(HistoryService);
    history.refresh();
    expect(history.progress().size).toBe(0);

    localStorage.setItem('shadowing.attempts', JSON.stringify([
      {
        sentenceId: 's9',
        status: 'scored',
        stars: 5,
        attemptedAt: new Date().toISOString(),
      },
    ]));
    history.refresh();

    expect(history.progress().get('s9')?.bestStars).toBe(5);
  });
});
