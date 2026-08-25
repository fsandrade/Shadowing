import { describe, expect, it } from 'vitest';
import { type Rng, shuffle } from './shuffle';

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
    expect(shuffle(['a', 'b', 'c', 'd', 'e'], seq([0.1, 0.2, 0.3, 0.4])))
      .toEqual(['b', 'c', 'd', 'e', 'a']);
  });

  it('produces different permutations for different rng sequences', () => {
    const a = shuffle(['a', 'b', 'c', 'd', 'e'], seq([0.1, 0.2, 0.3, 0.4]));
    const b = shuffle(['a', 'b', 'c', 'd', 'e'], seq([0.9, 0.8, 0.7, 0.6]));
    expect(a).not.toEqual(b);
  });

  it('guards against rng returning exactly 1.0', () => {
    const out = shuffle(['a', 'b', 'c', 'd', 'e'], () => 1.0);
    expect(out.length).toBe(5);
    expect([...out].sort()).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('handles the empty list', () => {
    expect(shuffle([], Math.random)).toEqual([]);
  });
});
