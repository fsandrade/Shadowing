import { describe, expect, it } from 'vitest';
import { canonicalWord } from './variants';

describe('canonicalWord', () => {
  it('folds the spellings a recognizer picks for the same word', () => {
    expect(canonicalWord('ok')).toBe(canonicalWord('okay'));
    expect(canonicalWord('grey')).toBe(canonicalWord('gray'));
    expect(canonicalWord('yea')).toBe(canonicalWord('yeah'));
    expect(canonicalWord('til')).toBe(canonicalWord('till'));
  });

  it('folds the joined form of a two-word spelling', () => {
    expect(canonicalWord('allright')).toBe(canonicalWord('alright'));
    expect(canonicalWord('goingto')).toBe(canonicalWord('gonna'));
    expect(canonicalWord('wantto')).toBe(canonicalWord('wanna'));
  });

  it('is stable, so canonicalizing twice changes nothing', () => {
    for (const word of ['ok', 'okay', 'grey', 'allright', 'goingto']) {
      expect(canonicalWord(canonicalWord(word))).toBe(canonicalWord(word));
    }
  });

  it('leaves every other word alone', () => {
    for (const word of ['agenda', 'roadmap', 'the', 'started', 'everyones']) {
      expect(canonicalWord(word)).toBe(word);
    }
  });

  it('does not fold words that merely look similar', () => {
    expect(canonicalWord('okra')).not.toBe(canonicalWord('okay'));
    expect(canonicalWord('grand')).not.toBe(canonicalWord('gray'));
  });
});
