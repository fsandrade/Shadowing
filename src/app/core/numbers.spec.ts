import { describe, expect, it } from 'vitest';
import { cardinalWords, joinDigitGroups, ordinalWords, spellNumbers } from './numbers';

describe('cardinalWords', () => {
  it('spells the small numbers', () => {
    expect(cardinalWords(0)).toEqual(['zero']);
    expect(cardinalWords(7)).toEqual(['seven']);
    expect(cardinalWords(13)).toEqual(['thirteen']);
  });

  it('spells the tens', () => {
    expect(cardinalWords(20)).toEqual(['twenty']);
    expect(cardinalWords(25)).toEqual(['twenty', 'five']);
    expect(cardinalWords(90)).toEqual(['ninety']);
  });

  it('spells hundreds and thousands', () => {
    expect(cardinalWords(100)).toEqual(['one', 'hundred']);
    expect(cardinalWords(342)).toEqual(['three', 'hundred', 'forty', 'two']);
    expect(cardinalWords(1000)).toEqual(['one', 'thousand']);
    expect(cardinalWords(2026)).toEqual(['two', 'thousand', 'twenty', 'six']);
  });

  it('spells millions', () => {
    expect(cardinalWords(1_000_000)).toEqual(['one', 'million']);
    expect(cardinalWords(2_500_000)).toEqual(['two', 'million', 'five', 'hundred', 'thousand']);
    expect(cardinalWords(1_234_567)).toEqual([
      'one', 'million', 'two', 'hundred', 'thirty', 'four', 'thousand',
      'five', 'hundred', 'sixty', 'seven',
    ]);
  });

  it('leaves anything it cannot spell as digits', () => {
    expect(cardinalWords(1_000_000_000)).toEqual(['1000000000']);
    expect(cardinalWords(-3)).toEqual(['-3']);
  });
});

describe('ordinalWords', () => {
  it('spells the irregular ordinals', () => {
    expect(ordinalWords(1)).toEqual(['first']);
    expect(ordinalWords(2)).toEqual(['second']);
    expect(ordinalWords(3)).toEqual(['third']);
    expect(ordinalWords(5)).toEqual(['fifth']);
    expect(ordinalWords(12)).toEqual(['twelfth']);
  });

  it('spells the regular ordinals', () => {
    expect(ordinalWords(4)).toEqual(['fourth']);
    expect(ordinalWords(7)).toEqual(['seventh']);
    expect(ordinalWords(15)).toEqual(['fifteenth']);
  });

  it('makes only the last word ordinal', () => {
    expect(ordinalWords(21)).toEqual(['twenty', 'first']);
    expect(ordinalWords(30)).toEqual(['thirtieth']);
    expect(ordinalWords(42)).toEqual(['forty', 'second']);
  });
});

describe('spellNumbers', () => {
  it('turns an ordinal digit form into words', () => {
    expect(spellNumbers('1st on the agenda').trim().replace(/\s+/g, ' '))
      .toBe('first on the agenda');
  });

  it('turns a cardinal digit form into words', () => {
    expect(spellNumbers('I have 3 tickets').trim().replace(/\s+/g, ' '))
      .toBe('I have three tickets');
  });

  it('separates digits that are glued to letters', () => {
    expect(spellNumbers('the Q3 roadmap').trim().replace(/\s+/g, ' '))
      .toBe('the Q three roadmap');
  });

  it('handles several numbers in one sentence', () => {
    expect(spellNumbers('2 of the 21st slides').trim().replace(/\s+/g, ' '))
      .toBe('two of the twenty first slides');
  });

  it('leaves text without numbers alone', () => {
    expect(spellNumbers('no numbers here')).toBe('no numbers here');
  });
});

describe('joinDigitGroups', () => {
  it('joins a thousands separator written as a dot', () => {
    expect(joinDigitGroups('up 10.000')).toBe('up 10000');
  });

  it('joins a thousands separator written as a comma', () => {
    expect(joinDigitGroups('about 1,500 people')).toBe('about 1500 people');
  });

  it('joins repeated groups', () => {
    expect(joinDigitGroups('1,234,567 total')).toBe('1234567 total');
    expect(joinDigitGroups('1.234.567 total')).toBe('1234567 total');
  });

  it('leaves decimals alone, because the group is not three digits', () => {
    expect(joinDigitGroups('it costs $3.50')).toBe('it costs $3.50');
    expect(joinDigitGroups('about 10.5 percent')).toBe('about 10.5 percent');
    expect(joinDigitGroups('roughly 2.75 hours')).toBe('roughly 2.75 hours');
  });

  it('leaves a number with too many leading digits alone', () => {
    expect(joinDigitGroups('code 1234.567')).toBe('code 1234.567');
  });

  it('does not join two separate numbers spaced apart', () => {
    expect(joinDigitGroups('room 12 300 seats')).toBe('room 12 300 seats');
  });

  it('leaves ordinary sentence punctuation alone', () => {
    expect(joinDigitGroups('He paid 10. Then he left.')).toBe('He paid 10. Then he left.');
  });
});
