import { describe, expect, it } from 'vitest';
import { normalizeSpeech, starsFor, wordSimilarity } from './scoring';

describe('normalizeSpeech', () => {
  it('lowercases, strips punctuation and collapses apostrophes', () => {
    expect(normalizeSpeech("I MUST'VE hit it, right?"))
      .toEqual(['i', 'mustve', 'hit', 'it', 'right']);
  });

  it('handles null, numbers and collapsed whitespace', () => {
    expect(normalizeSpeech(null)).toEqual([]);
    expect(normalizeSpeech(undefined)).toEqual([]);
    expect(normalizeSpeech(42)).toEqual(['42']);
    expect(normalizeSpeech('  a   b  ')).toEqual(['a', 'b']);
  });
});

describe('wordSimilarity', () => {
  it('is 1 for identical text and 0 for disjoint text', () => {
    expect(wordSimilarity('hit the road', 'hit the road')).toBe(1);
    expect(wordSimilarity('hit the road', 'zebra quilt fjord')).toBe(0);
  });

  it('ignores punctuation, case and spacing', () => {
    expect(wordSimilarity('Hit the road!', 'hit   the road')).toBe(1);
  });

  it('scores a missing tail word below 1', () => {
    const sim = wordSimilarity('hit the road jack', 'hit the road');
    expect(sim).toBeGreaterThan(0);
    expect(sim).toBeLessThan(1);
  });

  it('handles empties', () => {
    expect(wordSimilarity('', '')).toBe(1);
    expect(wordSimilarity('hello', '')).toBe(0);
    expect(wordSimilarity('', 'hello')).toBe(0);
  });
});

describe('starsFor', () => {
  it('gives 5 stars on an exact match and null on silence', () => {
    expect(starsFor('hit the road', 'hit the road')).toBe(5);
    expect(starsFor('hit the road', '')).toBeNull();
    expect(starsFor('hit the road', '   ')).toBeNull();
  });

  it('maps similarity to the approved thresholds', () => {
    // 0 words of 4 shared -> sim 0 -> 0 stars
    expect(starsFor('one two three four', 'alpha beta gamma delta')).toBe(0);
    // 3 of 4 shared -> sim 2*3/8 = 0.75 -> 3 stars
    expect(starsFor('one two three four', 'one two three delta')).toBe(3);
  });
});
