import { describe, expect, it } from 'vitest';
import { CUSTOM_TEXT_LIMIT, splitSentences } from './sentences';

describe('splitSentences', () => {
  it('splits on sentence-ending punctuation', () => {
    expect(splitSentences('One thing. Two things! Three things?'))
      .toEqual(['One thing.', 'Two things!', 'Three things?']);
  });

  it('keeps abbreviations inside their sentence', () => {
    expect(splitSentences('Mr. Smith arrived late. Dr. Jones did not.'))
      .toEqual(['Mr. Smith arrived late.', 'Dr. Jones did not.']);
  });

  it('does not split decimals', () => {
    expect(splitSentences('It costs $3.50 today.')).toEqual(['It costs $3.50 today.']);
  });

  it('splits paragraphs', () => {
    expect(splitSentences('First para.\n\nSecond para.'))
      .toEqual(['First para.', 'Second para.']);
  });

  it('keeps a trailing sentence with no final punctuation', () => {
    expect(splitSentences('Done here. And this one too'))
      .toEqual(['Done here.', 'And this one too']);
  });

  it('trims surrounding whitespace', () => {
    expect(splitSentences('   Padded out.   ')).toEqual(['Padded out.']);
  });

  it('drops fragments with nothing speakable in them', () => {
    expect(splitSentences('Real words here. ... --- !!!')).toEqual(['Real words here.']);
  });

  it('returns nothing for blank input', () => {
    expect(splitSentences('')).toEqual([]);
    expect(splitSentences('    \n  ')).toEqual([]);
  });

  it('handles a single sentence with no punctuation at all', () => {
    expect(splitSentences('just one line')).toEqual(['just one line']);
  });
});

describe('CUSTOM_TEXT_LIMIT', () => {
  it('is large enough for a few pages but bounded', () => {
    expect(CUSTOM_TEXT_LIMIT).toBe(20000);
  });

  it('splits text at the limit without stalling', () => {
    const text = 'This is a sentence. '.repeat(CUSTOM_TEXT_LIMIT / 20);
    const lines = splitSentences(text.slice(0, CUSTOM_TEXT_LIMIT));
    expect(lines.length).toBe(1000);
    expect(lines[0]).toBe('This is a sentence.');
  });
});
