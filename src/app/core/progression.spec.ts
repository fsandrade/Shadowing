import { describe, expect, it } from 'vitest';
import type { Sentence } from './catalog';
import {
  addDeckCounts, buildQueue, deckCounts, EMPTY_DECK_COUNTS, type SentenceProgress,
} from './progression';

function sentence(id: string): Sentence {
  return { id, topicId: 'a', text: id };
}

function progress(
  entries: Record<string, Partial<SentenceProgress>>,
): Map<string, SentenceProgress> {
  const map = new Map<string, SentenceProgress>();
  for (const [id, value] of Object.entries(entries)) {
    map.set(id, {
      bestStars: 0, lastStars: 0, lastAttemptedAt: 0, streak: 0, mastered: false,
      ...value,
    });
  }
  return map;
}

const identity = (): number => 1;

describe('buildQueue', () => {
  it('returns an empty queue for no available sentences', () => {
    expect(buildQueue([], new Map(), identity)).toEqual([]);
  });

  it('offers a mastered sentence after learning and new sentences', () => {
    const queue = buildQueue(
      [sentence('done'), sentence('fresh'), sentence('weak')],
      progress({
        done: { bestStars: 5, lastStars: 5, mastered: true },
        weak: { bestStars: 2, lastStars: 2 },
      }),
      identity,
    );
    expect(queue.map((s) => s.id)).toEqual(['weak', 'fresh', 'done']);
  });

  it('keeps a mastered sentence when its latest rating is low', () => {
    const queue = buildQueue(
      [sentence('done'), sentence('fresh')],
      progress({ done: { bestStars: 5, lastStars: 0, mastered: true } }),
      identity,
    );
    expect(queue.map((s) => s.id)).toEqual(['fresh', 'done']);
  });

  it('orders learning grades low to high, then new, then mastered grades', () => {
    const queue = buildQueue(
      [
        sentence('four'), sentence('unseen'), sentence('three'),
        sentence('mastered-good'), sentence('mastered-low'),
      ],
      progress({
        four: { bestStars: 4, lastStars: 4 },
        three: { bestStars: 3, lastStars: 3 },
        'mastered-good': { bestStars: 5, lastStars: 5, mastered: true },
        'mastered-low': { bestStars: 5, lastStars: 0, mastered: true },
      }),
      identity,
    );
    expect(queue.map((s) => s.id)).toEqual([
      'three', 'four', 'unseen', 'mastered-low', 'mastered-good',
    ]);
  });

  it('shuffles inside a grade without moving sentences between priority groups', () => {
    const queue = buildQueue(
      [sentence('u1'), sentence('u2'), sentence('u3'), sentence('g1'), sentence('g2'),
        sentence('m1'), sentence('m2')],
      progress({
        g1: { bestStars: 3, lastStars: 3 },
        g2: { bestStars: 3, lastStars: 3 },
        m1: { bestStars: 5, lastStars: 4, mastered: true },
        m2: { bestStars: 5, lastStars: 4, mastered: true },
      }),
      () => 0,
    );
    expect(queue.map((s) => s.id)).toEqual(['g2', 'g1', 'u2', 'u3', 'u1', 'm2', 'm1']);
  });
});

describe('deckCounts', () => {
  it('is empty for no sentences', () => {
    expect(deckCounts([], new Map())).toEqual(EMPTY_DECK_COUNTS);
  });

  it('classifies fresh, learning and due sentences', () => {
    expect(deckCounts(
      [sentence('unseen'), sentence('weak'), sentence('done')],
      progress({
        weak: { lastStars: 2, streak: 0, mastered: false },
        done: { bestStars: 5, lastStars: 5, mastered: true },
      }),
    )).toEqual({ fresh: 1, learning: 1, due: 1 });
  });

  it('counts a failed sentence as learning', () => {
    expect(deckCounts(
      [sentence('failed')],
      progress({ failed: { lastStars: 0, streak: 0, mastered: false } }),
    )).toEqual({ fresh: 0, learning: 1, due: 0 });
  });

  it('keeps a mastered sentence due when its latest rating is low', () => {
    expect(deckCounts(
      [sentence('done')],
      progress({ done: { lastStars: 0, mastered: true } }),
    )).toEqual({ fresh: 0, learning: 0, due: 1 });
  });

  it('adds counts field by field', () => {
    expect(addDeckCounts(
      { fresh: 2, learning: 1, due: 0 },
      { fresh: 3, learning: 0, due: 4 },
    )).toEqual({ fresh: 5, learning: 1, due: 4 });
  });
});
