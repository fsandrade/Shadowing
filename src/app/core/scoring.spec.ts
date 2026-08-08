import { describe, expect, it } from 'vitest';
import {
  COMPLETE_COVERAGE, coverage, normalizeSpeech, reachedLastWord,
  soundsComplete, starsFor, wordSimilarity,
} from './scoring';

describe('normalizeSpeech', () => {
  it('lowercases, strips punctuation and collapses apostrophes', () => {
    expect(normalizeSpeech("I MUST'VE hit it, right?"))
      .toEqual(['i', 'mustve', 'hit', 'it', 'right']);
  });

  it('handles null and collapsed whitespace', () => {
    expect(normalizeSpeech(null)).toEqual([]);
    expect(normalizeSpeech(undefined)).toEqual([]);
    expect(normalizeSpeech('  a   b  ')).toEqual(['a', 'b']);
  });

  it('spells numbers out so digits and words compare equal', () => {
    expect(normalizeSpeech(42)).toEqual(['forty', 'two']);
    expect(normalizeSpeech('1st')).toEqual(['first']);
    expect(normalizeSpeech('Q3')).toEqual(['q', 'three']);
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

describe('scoring around recognizer formatting', () => {
  const agenda = 'First on the agenda is the Q3 roadmap.';

  it('gives full marks when the recognizer only formats differently', () => {
    expect(starsFor(agenda, '1st on the agenda is the Q3 road map.')).toBe(5);
  });

  it('treats such a repeat as complete, so listening stops right away', () => {
    expect(soundsComplete(agenda, '1st on the agenda is the Q3 road map.')).toBe(true);
  });

  it('scores an ordinal written either way the same', () => {
    expect(starsFor('The 2nd item is ready', 'The second item is ready')).toBe(5);
    expect(starsFor('The second item is ready', 'The 2nd item is ready')).toBe(5);
  });

  it('scores a cardinal written either way the same', () => {
    expect(starsFor('I need 25 copies', 'I need twenty-five copies')).toBe(5);
    expect(starsFor('It cost 342 pounds', 'It cost 342 pounds')).toBe(5);
  });

  it('scores a grouped number the same as the words for it', () => {
    const salary = 'He asked for a bigger base and managed to negotiate the salary up ten thousand.';
    expect(starsFor(salary, 'He asked for a bigger base and managed to negotiate the salary up 10.000.'))
      .toBe(5);
    expect(soundsComplete(salary, 'He asked for a bigger base and managed to negotiate the salary up 10.000.'))
      .toBe(true);
  });

  it('scores either grouping separator the same', () => {
    expect(starsFor('They raised ten thousand', 'They raised 10,000')).toBe(5);
    expect(starsFor('They raised ten thousand', 'They raised 10.000')).toBe(5);
    expect(starsFor('They raised 10,000', 'They raised ten thousand')).toBe(5);
  });

  it('still hears a decimal as a decimal', () => {
    expect(starsFor('It costs three fifty', 'It costs 3.50')).toBe(5);
  });

  it('rejoins a compound the recognizer split', () => {
    expect(starsFor('Check the roadmap today', 'Check the road map today')).toBe(5);
    expect(starsFor('Send me the whiteboard photo', 'Send me the white board photo')).toBe(5);
  });

  it('splits a compound the recognizer joined', () => {
    expect(starsFor('Send me the white board photo', 'Send me the whiteboard photo')).toBe(5);
  });

  it('gives full marks when the recognizer picks another spelling', () => {
    const greeting = "Okay, I think everyone's here, so let's get started.";
    const heard = "Ok, I think everyone's here, so let's get started.";
    expect(starsFor(greeting, heard)).toBe(5);
    expect(soundsComplete(greeting, heard)).toBe(true);
  });

  it('accepts either spelling of the same sound in either direction', () => {
    expect(starsFor('It looks gray outside', 'It looks grey outside')).toBe(5);
    expect(starsFor('It looks grey outside', 'It looks gray outside')).toBe(5);
  });

  it('accepts a two-word spelling when the sound is the same', () => {
    expect(starsFor('Alright, let us go', 'All right, let us go')).toBe(5);
  });

  it('leaves the speaker responsible for the sounds they chose', () => {
    expect(starsFor('We are gonna be late', 'We are going to be late')).toBeLessThan(5);
    expect(starsFor('You gotta try this', 'You got to try this')).toBeLessThan(5);
    expect(starsFor('Yeah, that works', 'Yep, that works')).toBeLessThan(5);
    expect(starsFor("I'm on my way", 'I am on my way')).toBeLessThan(5);
  });

  it('still penalizes actually saying the wrong words', () => {
    expect(starsFor(agenda, 'Second on the agenda is the Q4 roadmap.')).toBeLessThan(5);
    expect(starsFor(agenda, 'the agenda roadmap')).toBeLessThan(4);
  });

  it('still penalizes leaving the sentence unfinished', () => {
    expect(soundsComplete(agenda, '1st on the agenda')).toBe(false);
  });
});

describe('finishing the sentence', () => {
  const clarify = 'Before we move on, let me jump in with a quick clarification.';
  const stoppedShort = 'Before we move on, let me jump in with a quick.';

  it('does not call a sentence complete while its last word is missing', () => {
    expect(coverage(clarify, stoppedShort)).toBeGreaterThan(COMPLETE_COVERAGE);
    expect(soundsComplete(clarify, stoppedShort)).toBe(false);
  });

  it('does not award full marks for a sentence that stopped short', () => {
    expect(wordSimilarity(clarify, stoppedShort)).toBeGreaterThan(0.95);
    expect(starsFor(clarify, stoppedShort)).toBe(4);
  });

  it('calls it complete as soon as the last word arrives', () => {
    expect(soundsComplete(clarify, clarify)).toBe(true);
    expect(starsFor(clarify, clarify)).toBe(5);
  });

  it('still forgives a word dropped in the middle', () => {
    const dropped = 'Before we move on, let me jump in with quick clarification.';
    expect(reachedLastWord(clarify, dropped)).toBe(true);
    expect(soundsComplete(clarify, dropped)).toBe(true);
    expect(starsFor(clarify, dropped)).toBe(5);
  });

  it('reports the end unreached for a transcript that is still building', () => {
    expect(reachedLastWord(clarify, 'Before we')).toBe(false);
    expect(reachedLastWord(clarify, 'Before we move on, let me jump')).toBe(false);
    expect(reachedLastWord(clarify, '')).toBe(false);
  });

  it('needs the last word in place, not merely somewhere in the transcript', () => {
    const target = 'Take the road past the old road';
    expect(reachedLastWord(target, 'Take the road past the old road')).toBe(true);
    expect(soundsComplete(target, 'Take the road past the old')).toBe(false);
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
