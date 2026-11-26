import type { Sentence } from './catalog';
import { type Rng, shuffle } from './shuffle';

export interface SentenceProgress {
  readonly bestStars: number;
  readonly lastStars: number;
  readonly lastAttemptedAt: number;
  readonly streak: number;
  readonly mastered: boolean;
}

function byGrade(
  sentences: readonly Sentence[],
  progress: ReadonlyMap<string, SentenceProgress>,
  rng: Rng,
): Sentence[] {
  const groups = new Map<number, Sentence[]>();
  for (const sentence of sentences) {
    const grade = progress.get(sentence.id)!.lastStars;
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

export function buildQueue(
  sentences: readonly Sentence[],
  progress: ReadonlyMap<string, SentenceProgress>,
  rng: Rng,
): Sentence[] {
  const learning: Sentence[] = [];
  const fresh: Sentence[] = [];
  const mastered: Sentence[] = [];

  for (const sentence of sentences) {
    const seen = progress.get(sentence.id);
    if (!seen) {
      fresh.push(sentence);
    } else if (seen.mastered) {
      mastered.push(sentence);
    } else {
      learning.push(sentence);
    }
  }

  return [
    ...byGrade(learning, progress, rng),
    ...shuffle(fresh, rng),
    ...byGrade(mastered, progress, rng),
  ];
}
