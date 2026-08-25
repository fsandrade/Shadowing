import { describe, expect, it } from 'vitest';

const { classify, measure, LEVELS } = require('./classify-level') as {
  classify: (text: string) => string;
  measure: (text: string) => { length: number; score: number; colloquial: number };
  LEVELS: string[];
};

const order = (level: string) => LEVELS.indexOf(level);

describe('classify', () => {
  it('returns one of the six CEFR bands', () => {
    expect(LEVELS).toEqual(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']);
    expect(LEVELS).toContain(classify('Anything at all.'));
  });

  it('rates a longer sentence above a shorter one built from the same register', () => {
    const short = classify('I need to go.');
    const long = classify(
      'I need to go now because the train leaves in about twenty minutes and I still have to pack.',
    );
    expect(order(long)).toBeGreaterThan(order(short));
  });

  it('rates rarer vocabulary above common vocabulary at the same length', () => {
    const common = measure('We talked about the plan for the day at work.');
    const rare = measure('We deliberated the contingency provisions at length.');
    expect(rare.score).toBeGreaterThan(common.score);
  });

  it('treats a contracted, colloquial form as harder than its plain equivalent', () => {
    expect(measure("How's it going?").colloquial)
      .toBeGreaterThan(measure('How are you?').colloquial);
    expect(measure("How's it going?").score)
      .toBeGreaterThan(measure('How are you?').score);
  });

  it('keeps one or two word utterances at A1 whatever words they use', () => {
    expect(classify('Hi!')).toBe('A1');
    expect(classify('Hello')).toBe('A1');
    expect(classify('Absolutely!')).toBe('A1');
  });

  it('caps very short sentences below the top bands', () => {
    expect(order(classify('Quite so.'))).toBeLessThanOrEqual(order('A2'));
    expect(order(classify('That begs the question.'))).toBeLessThanOrEqual(order('B1'));
  });

  it('ignores the chunk markup when measuring', () => {
    const plain = measure('You wanna grab a coffee before the meeting?');
    const marked = measure('You wanna <b>grab a coffee</b> before the meeting?');
    expect(marked.length).toBe(plain.length);
    expect(marked.score).toBeCloseTo(plain.score, 10);
  });

  it('does not let a person\'s name count as rare vocabulary', () => {
    const withName = measure('Priya said the meeting moved to three.');
    const withWord = measure('She said the meeting moved to three.');
    expect(Math.abs(withName.score - withWord.score)).toBeLessThan(0.02);

    const midName = measure('The meeting with Priya moved to three.');
    const midWord = measure('The meeting with her moved to three.');
    expect(Math.abs(midName.score - midWord.score)).toBeLessThan(0.02);
  });

  it('recognises inflected forms of common words', () => {
    const inflected = measure('She was hurrying to the shops.');
    const base = measure('She was hurry to the shop.');
    expect(Math.abs(inflected.score - base.score)).toBeLessThan(0.02);
  });

  it('is stable: the same sentence always lands in the same band', () => {
    const text = 'We should grab a coffee sometime and catch up.';
    expect(classify(text)).toBe(classify(text));
  });
});
