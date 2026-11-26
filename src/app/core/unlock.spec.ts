import { describe, expect, it } from 'vitest';
import type { Sentence } from './catalog';
import { INITIAL_POOL_SIZE, unlockedSentences } from './unlock';
import { sortByDifficulty } from './word-count';

function deck(topicId: string, size: number): Sentence[] {
  return Array.from({ length: size }, (_, i) => ({
    id: `${topicId}-${String(i).padStart(2, '0')}`,
    topicId,
    text: `${topicId} ${'word '.repeat(i).trim()}`,
  }));
}

function ids(sentences: readonly Sentence[]): string[] {
  return sentences.map((s) => s.id);
}

describe('unlockedSentences', () => {
  it('starts with the twenty shortest sentences', () => {
    const sentences = deck('a', 25);
    const pool = unlockedSentences(sentences, new Set());

    expect(pool).toHaveLength(INITIAL_POOL_SIZE);
    expect(ids(pool)).toEqual(ids(sentences.slice(0, 20)));
  });

  it('releases one more sentence per mastered sentence', () => {
    const sentences = deck('a', 40);
    const one = new Set(ids(sentences.slice(0, 1)));
    const ten = new Set(ids(sentences.slice(0, 10)));

    expect(unlockedSentences(sentences, one)).toHaveLength(21);
    expect(ids(unlockedSentences(sentences, one))).toEqual(ids(sentences.slice(0, 21)));
    expect(unlockedSentences(sentences, ten)).toHaveLength(30);
    expect(ids(unlockedSentences(sentences, ten))).toEqual(ids(sentences.slice(0, 30)));
  });

  it('unlocks everything in a small subject and nothing in an empty one', () => {
    expect(unlockedSentences(deck('a', 5), new Set())).toHaveLength(5);
    expect(unlockedSentences([], new Set(['a-00']))).toEqual([]);
  });

  it('does not let mastery in one subject unlock another subject', () => {
    const a = deck('a', 25);
    const b = deck('b', 25);
    const mastered = new Set(ids(a.slice(0, 5)));

    expect(unlockedSentences([...a, ...b], mastered)).toHaveLength(25 + 20);
    expect(ids(unlockedSentences(b, mastered))).toEqual(ids(b.slice(0, 20)));
  });

  it('sorts the all-topics union by word count, then id', () => {
    const a = deck('a', 3);
    const b = deck('b', 3);
    const all = unlockedSentences([...b, ...a], new Set());

    expect(ids(all)).toEqual(ids(sortByDifficulty([...a, ...b])));
  });

  it('keeps mastery from outside the shortest pool reachable', () => {
    const sentences = deck('a', 48);
    const mastered = new Set(ids(sentences.slice(45, 48)));

    const pool = unlockedSentences(sentences, mastered);

    expect(ids(pool)).toEqual([...ids(sentences.slice(0, 20)), ...mastered]);
  });

  it('ignores mastered ids that are not in the input', () => {
    expect(unlockedSentences(deck('a', 25), new Set(['missing'])))
      .toHaveLength(INITIAL_POOL_SIZE);
  });
});
