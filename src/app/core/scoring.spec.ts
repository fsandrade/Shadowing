import { describe, expect, it } from 'vitest';
import {
  coverage, normalizeSpeech, soundsComplete, starsFor, wordSimilarity,
} from './scoring';

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

describe('coverage', () => {
  const target = 'one two three four';

  it('is the share of the target that has been said', () => {
    expect(coverage(target, 'one two')).toBe(0.5);
    expect(coverage(target, 'one two three')).toBe(0.75);
    expect(coverage(target, target)).toBe(1);
  });

  it('is not reduced by filler the speaker added', () => {
    expect(coverage(target, 'um one two er three four you know')).toBe(1);
  });

  it('is 0 for silence or for entirely wrong words', () => {
    expect(coverage(target, '')).toBe(0);
    expect(coverage(target, 'alpha beta gamma delta')).toBe(0);
  });
});

describe('soundsComplete', () => {
  const target = 'I must have hit the snooze button like four times this morning';

  it('is false before anything has been said', () => {
    expect(soundsComplete(target, '')).toBe(false);
    expect(soundsComplete(target, '   ')).toBe(false);
  });

  it('is false part way through, so a slow speaker is not cut off', () => {
    expect(soundsComplete(target, 'I must have hit the')).toBe(false);
    expect(soundsComplete(target, 'I must have hit the snooze button')).toBe(false);
    expect(soundsComplete(target, 'I must have hit the snooze button like four')).toBe(false);
  });

  it('is true once the whole sentence has been said', () => {
    expect(soundsComplete(target, target)).toBe(true);
  });

  it('tolerates one word the recognizer dropped', () => {
    expect(soundsComplete(target, 'I must have hit the snooze button four times this morning'))
      .toBe(true);
  });

  it('is true despite filler around a complete repeat', () => {
    expect(soundsComplete(target, `um ${target} you know`)).toBe(true);
  });

  it('is false when the words are wrong even at full length', () => {
    expect(soundsComplete(target, 'alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu'))
      .toBe(false);
  });
});

describe('starsFor', () => {
  it('gives 5 stars on an exact match and null on silence', () => {
    expect(starsFor('hit the road', 'hit the road')).toBe(5);
    expect(starsFor('hit the road', '')).toBeNull();
    expect(starsFor('hit the road', '   ')).toBeNull();
  });

  it('maps similarity to the approved thresholds', () => {
    expect(starsFor('one two three four', 'alpha beta gamma delta')).toBe(0);

    expect(starsFor('one two three four', 'one two three delta')).toBe(3);
  });
});
