import type { Sentence } from './catalog';

const WORD = /[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu;

export function countWords(text: string): number {
  const plain = String(text ?? '').replace(/<[^>]*>/g, ' ');
  return plain.match(WORD)?.length ?? 0;
}

export function sortByDifficulty(sentences: readonly Sentence[]): Sentence[] {
  return [...sentences].sort((a, b) =>
    countWords(a.text) - countWords(b.text) || a.id.localeCompare(b.id),
  );
}
