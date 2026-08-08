import { describe, expect, it } from 'vitest';
import { type Rng, shuffle } from './shuffle';

/** Feeds a fixed sequence of rng values, one per swap. */
function seq(values: number[]): Rng {
  let i = 0;
  return () => values[i++];
}

describe('shuffle', () => {
  it('keeps every element exactly once', () => {
    const input = ['a', 'b', 'c', 'd', 'e'];
    expect([...shuffle(input, () => 0.5)].sort()).toEqual([...input].sort());
  });

  it('returns a new array and leaves the input alone', () => {
    const input = ['a', 'b', 'c'];
    const out = shuffle(input, () => 0);
    expect(out).not.toBe(input);
    expect(input).toEqual(['a', 'b', 'c']);
  });

  it('applies the rng to the algorithm, not just the input', () => {
    // Each value floors to index 0, so every step swaps the tail to the front
    // and the list rotates left by one.
    expect(shuffle(['a', 'b', 'c', 'd', 'e'], seq([0.1, 0.2, 0.3, 0.4])))
      .toEqual(['b', 'c', 'd', 'e', 'a']);
  });

  it('produces different permutations for different rng sequences', () => {
    const a = shuffle(['a', 'b', 'c', 'd', 'e'], seq([0.1, 0.2, 0.3, 0.4]));
    const b = shuffle(['a', 'b', 'c', 'd', 'e'], seq([0.9, 0.8, 0.7, 0.6]));
    expect(a).not.toEqual(b);
  });

  it('guards against rng returning exactly 1.0', () => {
    // Without the clamp, floor(1.0 * (i + 1)) would index one past the end.
    const out = shuffle(['a', 'b', 'c', 'd', 'e'], () => 1.0);
    expect(out.length).toBe(5);
    expect([...out].sort()).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('handles the empty list', () => {
    expect(shuffle([], Math.random)).toEqual([]);
  });
});
