import { describe, expect, it } from 'vitest';
import type { Sentence } from './catalog';
import { countWords, sortByDifficulty } from './word-count';

function sentence(id: string, text: string): Sentence {
  return { id, topicId: 'a', text };
}

describe('countWords', () => {
  it('counts ordinary words', () => {
    expect(countWords('I agree with you.')).toBe(4);
  });

  it('counts a contraction as one word', () => {
    expect(countWords("I'll take care of it.")).toBe(5);
  });

  it('ignores markup', () => {
    expect(countWords('Just <b>checking in</b> to see if you had a chance to review the draft.'))
      .toBe(14);
  });

  it('normalizes whitespace and handles text without words', () => {
    expect(countWords('  I\n agree\twith   you.  ')).toBe(4);
    expect(countWords('')).toBe(0);
    expect(countWords('!!! --- ...')).toBe(0);
  });
});

describe('sortByDifficulty', () => {
  it('orders by ascending word count, then by sentence id', () => {
    const input = [
      sentence('c', 'I agree with you.'),
      sentence('b', 'One two three four five.'),
      sentence('z', 'A short line.'),
      sentence('a', 'Another short line.'),
    ];
    const before = [...input];

    expect(sortByDifficulty(input).map((s) => s.id)).toEqual(['a', 'z', 'c', 'b']);
    expect(input).toEqual(before);
  });
});
