import { spellNumbers } from './numbers';

export function normalizeSpeech(text: unknown): string[] {
  return spellNumbers(String(text ?? '').toLowerCase())
    .replace(/'/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function joinSplitWords(
  tokens: readonly string[],
  vocabulary: ReadonlySet<string>,
): string[] {
  const out: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const joined = i + 1 < tokens.length ? tokens[i] + tokens[i + 1] : '';
    if (joined && vocabulary.has(joined) && !vocabulary.has(tokens[i])) {
      out.push(joined);
      i++;
    } else {
      out.push(tokens[i]);
    }
  }
  return out;
}

function align(base: string, transcript: string): [string[], string[]] {
  const spoken = normalizeSpeech(transcript);
  const target = normalizeSpeech(base);
  const spokenJoined = joinSplitWords(spoken, new Set(target));
  const targetJoined = joinSplitWords(target, new Set(spokenJoined));
  return [targetJoined, spokenJoined];
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

export function wordSimilarity(base: string, transcript: string): number {
  const [a, b] = align(base, transcript);
  if (!a.length && !b.length) { return 1; }
  if (!a.length || !b.length) { return 0; }
  return (2 * lcsLength(a, b)) / (a.length + b.length);
}

export function coverage(base: string, transcript: string): number {
  const [a, b] = align(base, transcript);
  if (!a.length || !b.length) { return 0; }
  return lcsLength(a, b) / a.length;
}

export const COMPLETE_COVERAGE = 0.9;

export function soundsComplete(base: string, transcript: string): boolean {
  return coverage(base, transcript) >= COMPLETE_COVERAGE;
}

export function starsFor(base: string, transcript: string): number | null {
  if (!normalizeSpeech(transcript).length) { return null; }
  const sim = wordSimilarity(base, transcript);
  if (sim < 0.45) { return 0; }
  if (sim < 0.60) { return 1; }
  if (sim < 0.70) { return 2; }
  if (sim < 0.80) { return 3; }
  if (sim < 0.95) { return 4; }
  return 5;
}
