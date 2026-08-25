import { describe, expect, it } from 'vitest';
import { starsFor } from './scoring';
import { missedWords, normalizeTyping, typedWords, typingStars } from './typing';

describe('normalizeTyping', () => {
  it('lowercases and drops sentence punctuation', () => {
    expect(normalizeTyping('Before we move on, let me jump in!'))
      .toEqual(['before', 'we', 'move', 'on', 'let', 'me', 'jump', 'in']);
  });

  it('keeps an apostrophe inside a word', () => {
    expect(normalizeTyping("everyone's here")).toEqual(["everyone's", 'here']);
  });

  it('treats a curly apostrophe as a straight one', () => {
    expect(normalizeTyping('don’t stop')).toEqual(normalizeTyping("don't stop"));
  });

  it('drops quote marks around a word', () => {
    expect(normalizeTyping("she said 'hello' twice")).toEqual(['she', 'said', 'hello', 'twice']);
  });

  it('splits a hyphenated word the same either way', () => {
    expect(normalizeTyping('twenty-five')).toEqual(['twenty', 'five']);
    expect(normalizeTyping('twenty five')).toEqual(['twenty', 'five']);
  });

  it('keeps digits as digits', () => {
    expect(normalizeTyping('the Q3 roadmap')).toEqual(['the', 'q3', 'roadmap']);
  });

  it('returns nothing for blank input', () => {
    expect(normalizeTyping('')).toEqual([]);
    expect(normalizeTyping('   ...   ')).toEqual([]);
    expect(normalizeTyping(null)).toEqual([]);
  });
});

describe('typingStars ignores what a keyboard cannot control', () => {
  const line = 'Before we move on, let me jump in with a quick clarification.';

  it('gives full marks for the sentence typed exactly', () => {
    expect(typingStars(line, line)).toBe(5);
  });

  it('ignores capitalisation', () => {
    expect(typingStars(line, 'before we move on, let me jump in with a quick clarification.'))
      .toBe(5);
  });

  it('ignores punctuation', () => {
    expect(typingStars(line, 'Before we move on let me jump in with a quick clarification'))
      .toBe(5);
  });

  it('ignores extra spacing', () => {
    expect(typingStars('hit the road', '  hit   the   road  ')).toBe(5);
  });
});

describe('typingStars holds the speller to the exact letters', () => {
  it('counts a misspelling as wrong', () => {
    expect(typingStars('a quick clarification', 'a quick clarifcation')).toBeLessThan(5);
    expect(typingStars('I recommend it', 'I recomend it')).toBeLessThan(5);
  });

  it('does not accept the other spelling of the same sound', () => {
    expect(typingStars('It looks gray outside', 'It looks grey outside')).toBeLessThan(5);
    expect(starsFor('It looks gray outside', 'It looks grey outside')).toBe(5);
  });

  it('does not accept a compound split in two', () => {
    expect(typingStars('Check the roadmap today', 'Check the road map today')).toBeLessThan(5);
    expect(starsFor('Check the roadmap today', 'Check the road map today')).toBe(5);
  });

  it('does not accept digits for a number written as words', () => {
    expect(typingStars('They raised ten thousand', 'They raised 10,000')).toBeLessThan(5);
    expect(starsFor('They raised ten thousand', 'They raised 10,000')).toBe(5);
  });

  it('minds where the apostrophe goes', () => {
    expect(typingStars("it's ready", 'its ready')).toBeLessThan(5);
  });

  it('counts a missing word', () => {
    expect(typingStars('let me jump in with a quick note', 'let me jump in with quick note'))
      .toBe(4);
  });

  it('counts a word that was never there', () => {
    expect(typingStars('the salary up ten thousand', 'the salary up to ten thousand')).toBe(4);
  });

  it('scores nothing typed as nothing', () => {
    expect(typingStars('hit the road', '')).toBeNull();
    expect(typingStars('hit the road', '   ')).toBeNull();
  });

  it('scores a completely different sentence near zero', () => {
    expect(typingStars('hit the road jack', 'completely unrelated words entirely')).toBe(0);
  });
});

describe('typedWords marks which words were wrong', () => {
  it('marks every word when the sentence is right', () => {
    expect(typedWords('hit the road', 'Hit the road'))
      .toEqual([
        { text: 'Hit', ok: true },
        { text: 'the', ok: true },
        { text: 'road', ok: true },
      ]);
  });

  it('marks only the misspelled word', () => {
    expect(typedWords('a quick clarification', 'a quik clarification'))
      .toEqual([
        { text: 'a', ok: true },
        { text: 'quik', ok: false },
        { text: 'clarification', ok: true },
      ]);
  });

  it('marks a word that does not belong', () => {
    expect(typedWords('the salary up', 'the salary up to'))
      .toEqual([
        { text: 'the', ok: true },
        { text: 'salary', ok: true },
        { text: 'up', ok: true },
        { text: 'to', ok: false },
      ]);
  });

  it('keeps the letters the learner actually typed, not a lowercased copy', () => {
    expect(typedWords('the Q3 roadmap', 'The Q3 Roadmap').map((w) => w.text))
      .toEqual(['The', 'Q3', 'Roadmap']);
  });

  it('returns nothing when nothing was typed', () => {
    expect(typedWords('hit the road', '')).toEqual([]);
  });
});

describe('missedWords names what was left out', () => {
  it('lists a word the learner skipped', () => {
    expect(missedWords('let me jump in with a quick note', 'let me jump in with quick note'))
      .toEqual(['a']);
  });

  it('lists nothing when the sentence is complete', () => {
    expect(missedWords('hit the road', 'Hit the road!')).toEqual([]);
  });

  it('keeps the original spelling of the missed word', () => {
    expect(missedWords('Check the roadmap today', 'Check the today')).toEqual(['roadmap']);
  });
});
