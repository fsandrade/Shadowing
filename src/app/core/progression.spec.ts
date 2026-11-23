import { describe, expect, it } from 'vitest';
import type { Sentence } from './catalog';
import { buildQueue, MASTERED_STARS, type SentenceProgress } from './progression';

function sentence(id: string): Sentence {
  return { id, topicId: 'a', text: id };
}

function progress(
  entries: Record<string, Partial<SentenceProgress>>,
): Map<string, SentenceProgress> {
  const map = new Map<string, SentenceProgress>();
  for (const [id, value] of Object.entries(entries)) {
    map.set(id, { bestStars: 0, lastStars: 0, lastAttemptedAt: 0, ...value });
  }
  return map;
}

const identity = (): number => 1;

describe('buildQueue', () => {
  it('returns an empty queue for no sentences', () => {
    expect(buildQueue([], new Map(), identity)).toEqual([]);
  });

  it('drops sentences whose best score is 5', () => {
    const queue = buildQueue(
      [sentence('done'), sentence('fresh')],
      progress({ done: { bestStars: MASTERED_STARS, lastStars: 5 } }),
      identity,
    );
    expect(queue.map((s) => s.id)).toEqual(['fresh']);
  });

  it('keeps a mastered sentence out even when its latest attempt failed', () => {
    const queue = buildQueue(
      [sentence('done')],
      progress({ done: { bestStars: 5, lastStars: 0 } }),
      identity,
    );
    expect(queue).toEqual([]);
  });

  it('orders grades low to high, with unseen sentences first', () => {
    const queue = buildQueue(
      [sentence('four'), sentence('unseen'), sentence('three')],
      progress({
        four: { bestStars: 4, lastStars: 4 },
        three: { bestStars: 3, lastStars: 3 },
      }),
      identity,
    );
    expect(queue.map((s) => s.id)).toEqual(['unseen', 'three', 'four']);
  });

  it('shuffles inside a grade without moving sentences between grades', () => {
    const queue = buildQueue(
      [sentence('u1'), sentence('u2'), sentence('u3'), sentence('g1'), sentence('g2')],
      progress({
        g1: { bestStars: 3, lastStars: 3 },
        g2: { bestStars: 3, lastStars: 3 },
      }),
      () => 0,
    );
    const ids = queue.map((s) => s.id);

    expect([...ids].sort()).toEqual(['g1', 'g2', 'u1', 'u2', 'u3']);
    expect([...ids.slice(0, 3)].sort()).toEqual(['u1', 'u2', 'u3']);
    expect([...ids.slice(3)].sort()).toEqual(['g1', 'g2']);
    expect(ids).not.toEqual(['u1', 'u2', 'u3', 'g1', 'g2']);
  });
});
