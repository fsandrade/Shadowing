/** Words only: lowercase, apostrophes dropped, everything else a separator. */
export function normalizeSpeech(text: unknown): string[] {
  return String(text ?? '')
    .toLowerCase()
    .replace(/'/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Dice coefficient over the longest common subsequence of words, so word order
 * counts but a dropped or added word degrades the score gracefully.
 * Returns 1 for two empty inputs and 0 when only one side is empty.
 */
export function wordSimilarity(base: string, transcript: string): number {
  const a = normalizeSpeech(base);
  const b = normalizeSpeech(transcript);
  if (!a.length && !b.length) { return 1; }
  if (!a.length || !b.length) { return 0; }

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
  return (2 * dp[a.length][b.length]) / (a.length + b.length);
}

/** 0-5 stars, or null when nothing was said. Thresholds are product-approved. */
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
