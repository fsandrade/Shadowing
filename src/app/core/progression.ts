import type { Sentence } from './catalog';
import { MAX_STARS } from './scoring';
import { type Rng, shuffle } from './shuffle';

export interface SentenceProgress {
  readonly bestStars: number;
  readonly lastStars: number;
  readonly lastAttemptedAt: number;
}

export const MASTERED_STARS = MAX_STARS;

export function buildQueue(
  sentences: readonly Sentence[],
  progress: ReadonlyMap<string, SentenceProgress>,
  rng: Rng,
): Sentence[] {
  const groups = new Map<number, Sentence[]>();

  for (const sentence of sentences) {
    const seen = progress.get(sentence.id);
    if (seen && seen.bestStars >= MASTERED_STARS) { continue; }

    const grade = seen ? seen.lastStars : 0;
    const group = groups.get(grade);
    if (group) {
      group.push(sentence);
    } else {
      groups.set(grade, [sentence]);
    }
  }

  const queue: Sentence[] = [];
  for (const grade of [...groups.keys()].sort((a, b) => a - b)) {
    queue.push(...shuffle(groups.get(grade)!, rng));
  }
  return queue;
}
