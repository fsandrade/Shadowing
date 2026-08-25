import { spellNumbers } from './numbers';
import { canonicalWord } from './variants';

export function normalizeSpeech(text: unknown): string[] {
  return spellNumbers(String(text ?? '').toLowerCase())
    .replace(/'/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map(canonicalWord);
}

function joinSplitWords(
  tokens: readonly string[],
  vocabulary: ReadonlySet<string>,
): string[] {
  const out: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const joined = i + 1 < tokens.length
      ? canonicalWord(tokens[i] + tokens[i + 1])
      : '';
    if (joined && vocabulary.has(joined) && !vocabulary.has(tokens[i])) {
      out.push(joined);
      i++;
    } else {
      out.push(tokens[i]);
    }
  }
  return out;
}

function lcsLength(a: readonly string[], b: readonly string[]): number {
  const dp: number[][] = Array.from({ length: a.length + 1 }, () =>
    new Array<number>(b.length + 1).fill(0),
  );
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1] + 1
        : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[a.length][b.length];
}

interface Alignment {
  readonly targetLength: number;
  readonly spokenLength: number;
  readonly matched: number;
  readonly reachedEnd: boolean;
}

function align(base: string, transcript: string): Alignment {
  const rawTarget = normalizeSpeech(base);
  const rawSpoken = normalizeSpeech(transcript);
  const spoken = joinSplitWords(rawSpoken, new Set(rawTarget));
  const target = joinSplitWords(rawTarget, new Set(spoken));

  const matched = lcsLength(target, spoken);
  const reachedEnd = target.length > 0
    && spoken.length > 0
    && matched > lcsLength(target.slice(0, -1), spoken);

  return {
    targetLength: target.length,
    spokenLength: spoken.length,
    matched,
    reachedEnd,
  };
}

export function wordSimilarity(base: string, transcript: string): number {
  const { targetLength, spokenLength, matched } = align(base, transcript);
  if (!targetLength && !spokenLength) { return 1; }
  if (!targetLength || !spokenLength) { return 0; }
  return (2 * matched) / (targetLength + spokenLength);
}

export function coverage(base: string, transcript: string): number {
  const { targetLength, spokenLength, matched } = align(base, transcript);
  if (!targetLength || !spokenLength) { return 0; }
  return matched / targetLength;
}

export function reachedLastWord(base: string, transcript: string): boolean {
  return align(base, transcript).reachedEnd;
}

export const COMPLETE_COVERAGE = 0.9;

export function soundsComplete(base: string, transcript: string): boolean {
  const { targetLength, spokenLength, matched, reachedEnd } = align(base, transcript);
  if (!targetLength || !spokenLength) { return false; }
  return reachedEnd && matched / targetLength >= COMPLETE_COVERAGE;
}

export interface AttemptCounts {
  readonly targetLength: number;
  readonly attemptLength: number;
  readonly matched: number;
}

export function speechCounts(base: string, transcript: string): AttemptCounts {
  const { targetLength, spokenLength, matched } = align(base, transcript);
  return { targetLength, attemptLength: spokenLength, matched };
}

export function similarityFromCounts(counts: AttemptCounts): number {
  const total = counts.targetLength + counts.attemptLength;
  return total ? (2 * counts.matched) / total : 0;
}

export function starsFromCounts(
  targetLength: number,
  attemptLength: number,
  matched: number,
): number | null {
  if (!attemptLength) { return null; }
  if (!targetLength) { return 0; }

  if (matched === targetLength && matched === attemptLength) { return 5; }

  const sim = (2 * matched) / (targetLength + attemptLength);
  if (sim < 0.45) { return 0; }
  if (sim < 0.60) { return 1; }
  if (sim < 0.70) { return 2; }
  if (sim < 0.80) { return 3; }
  return 4;
}

export function starsFor(base: string, transcript: string): number | null {
  const { targetLength, spokenLength, matched } = align(base, transcript);
  return starsFromCounts(targetLength, spokenLength, matched);
}
