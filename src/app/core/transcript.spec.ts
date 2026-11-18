import { describe, expect, it } from 'vitest';
import { mergeSegmentsToLines } from './transcript';

describe('mergeSegmentsToLines', () => {
  it('merges fragments into one line until sentence-ending punctuation', () => {
    const segments = [
      { start: 0, text: 'Once upon a time,' },
      { start: 1.2, text: 'in a kingdom' },
      { start: 2.4, text: 'very far away,' },
    ];
    expect(mergeSegmentsToLines(segments)).toEqual([
      { start: 0, text: 'Once upon a time, in a kingdom very far away,' },
    ]);
  });

  it('splits into multiple lines at sentence boundaries', () => {
    const segments = [
      { start: 0, text: 'Hello there.' },
      { start: 1.0, text: 'How are you today?' },
    ];
    const lines = mergeSegmentsToLines(segments);
    expect(lines.map((l) => l.text)).toEqual(['Hello there.', 'How are you today?']);
    expect(lines.map((l) => l.start)).toEqual([0, 1.0]);
  });

  it('keeps the start of the fragment that begins each line', () => {
    const lines = mergeSegmentsToLines([
      { start: 5, text: 'part' },
      { start: 6, text: 'two.' },
      { start: 8, text: 'next line' },
    ]);
    expect(lines.map((l) => l.start)).toEqual([5, 8]);
  });

  it('breaks a long caption gap even without punctuation', () => {
    const lines = mergeSegmentsToLines([
      { start: 0, text: 'first chunk of words' },
      { start: 4, text: 'second longer chunk of words here' },
    ]);
    expect(lines.length).toBeGreaterThanOrEqual(1);
    expect(lines[lines.length - 1].start).toBe(4);
  });

  it('drops empty result lines and handles a blank input', () => {
    expect(mergeSegmentsToLines([])).toEqual([]);
    expect(mergeSegmentsToLines([{ start: 0, text: '' }])).toEqual([]);
  });
});
