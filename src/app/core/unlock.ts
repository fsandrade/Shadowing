import type { Sentence } from './catalog';
import { sortByDifficulty } from './word-count';

export const INITIAL_POOL_SIZE = 20;

export function unlockedSentences(
  sentences: readonly Sentence[],
  masteredIds: ReadonlySet<string>,
): Sentence[] {
  const groups = new Map<string, Sentence[]>();
  for (const sentence of sentences) {
    const group = groups.get(sentence.topicId) ?? [];
    group.push(sentence);
    groups.set(sentence.topicId, group);
  }

  const pool: Sentence[] = [];
  for (const group of groups.values()) {
    const sorted = sortByDifficulty(group);
    const mastered = sorted.filter((s) => masteredIds.has(s.id));
    const rest = sorted.filter((s) => !masteredIds.has(s.id));
    const count = Math.min(INITIAL_POOL_SIZE + mastered.length, sorted.length);
    // Legacy mastery can sit outside the shortest pool; keep those sentences reachable.
    pool.push(...mastered, ...rest.slice(0, Math.max(0, count - mastered.length)));
  }
  return sortByDifficulty(pool);
}
