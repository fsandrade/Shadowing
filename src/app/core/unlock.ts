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
    const mastered = sorted.filter((s) => masteredIds.has(s.id)).length;
    pool.push(...sorted.slice(0, Math.min(INITIAL_POOL_SIZE + mastered, sorted.length)));
  }
  return sortByDifficulty(pool);
}
