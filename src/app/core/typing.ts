import { starsFromCounts } from './scoring';

export interface TypedWord {
  readonly text: string;
  readonly ok: boolean;
}

interface Token {
  readonly raw: string;
  readonly key: string;
}

const APOSTROPHES = /[’‘ʼ]/g;
const WORDS = /[A-Za-z0-9']+/g;
const EDGE_APOSTROPHES = /^'+|'+$/g;

function tokenize(text: unknown): Token[] {
  const cleaned = String(text ?? '').replace(APOSTROPHES, "'");
  return (cleaned.match(WORDS) ?? [])
    .map((raw) => ({ raw, key: raw.toLowerCase().replace(EDGE_APOSTROPHES, '') }))
    .filter((token) => token.key.length > 0);
}

export function normalizeTyping(text: unknown): string[] {
  return tokenize(text).map((token) => token.key);
}

function matchFlags(target: readonly string[], typed: readonly string[]): boolean[] {
  const dp: number[][] = Array.from({ length: target.length + 1 }, () =>
    new Array<number>(typed.length + 1).fill(0),
  );
  for (let i = 1; i <= target.length; i++) {
    for (let j = 1; j <= typed.length; j++) {
      dp[i][j] = target[i - 1] === typed[j - 1]
        ? dp[i - 1][j - 1] + 1
        : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }

  const flags = new Array<boolean>(typed.length).fill(false);
  let i = target.length;
  let j = typed.length;
  while (i > 0 && j > 0) {
    if (target[i - 1] === typed[j - 1]) {
      flags[j - 1] = true;
      i--;
      j--;
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }
  return flags;
}

export function typedWords(base: string, typed: string): TypedWord[] {
  const target = normalizeTyping(base);
  const tokens = tokenize(typed);
  const flags = matchFlags(target, tokens.map((token) => token.key));
  return tokens.map((token, i) => ({ text: token.raw, ok: flags[i] }));
}

export function missedWords(base: string, typed: string): string[] {
  const target = tokenize(base);
  const flags = matchFlags(normalizeTyping(typed), target.map((token) => token.key));
  return target.filter((_, i) => !flags[i]).map((token) => token.raw);
}

export function typingStars(base: string, typed: string): number | null {
  const target = normalizeTyping(base);
  const words = normalizeTyping(typed);
  const matched = matchFlags(target, words).filter(Boolean).length;
  return starsFromCounts(target.length, words.length, matched);
}
