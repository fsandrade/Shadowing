import type { Sentence } from './catalog';
import { type Rng, shuffle } from './shuffle';

export interface SentenceProgress {
  readonly bestStars: number;
  readonly lastStars: number;
  readonly lastAttemptedAt: number;
  readonly streak: number;
  readonly mastered: boolean;
}

export interface DeckCounts {
  readonly fresh: number;
  readonly learning: number;
  readonly due: number;
}

export const EMPTY_DECK_COUNTS: DeckCounts = { fresh: 0, learning: 0, due: 0 };

type DeckGroup = 'fresh' | 'learning' | 'due';

function deckGroup(
  progress: ReadonlyMap<string, SentenceProgress>,
  id: string,
): DeckGroup {
  const seen = progress.get(id);
  if (!seen) { return 'fresh'; }
  return seen.mastered ? 'due' : 'learning';
}

export function deckCounts(
  sentences: readonly Sentence[],
  progress: ReadonlyMap<string, SentenceProgress>,
): DeckCounts {
  let fresh = 0;
  let learning = 0;
  let due = 0;
  for (const sentence of sentences) {
    switch (deckGroup(progress, sentence.id)) {
      case 'fresh': fresh++; break;
      case 'learning': learning++; break;
      case 'due': due++; break;
    }
  }
  return { fresh, learning, due };
}

export function addDeckCounts(a: DeckCounts, b: DeckCounts): DeckCounts {
  return {
    fresh: a.fresh + b.fresh,
    learning: a.learning + b.learning,
    due: a.due + b.due,
  };
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
    switch (deckGroup(progress, sentence.id)) {
      case 'fresh': fresh.push(sentence); break;
      case 'due': mastered.push(sentence); break;
      case 'learning': learning.push(sentence); break;
    }
  }

  return [
    ...byGrade(learning, progress, rng),
    ...shuffle(fresh, rng),
    ...byGrade(mastered, progress, rng),
  ];
}
