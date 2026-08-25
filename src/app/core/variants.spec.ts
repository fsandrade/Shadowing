import { describe, expect, it } from 'vitest';
import { canonicalWord } from './variants';

describe('canonicalWord', () => {
  it('folds spellings the recognizer picks for an identical sound', () => {
    expect(canonicalWord('ok')).toBe(canonicalWord('okay'));
    expect(canonicalWord('grey')).toBe(canonicalWord('gray'));
    expect(canonicalWord('yea')).toBe(canonicalWord('yeah'));
    expect(canonicalWord('til')).toBe(canonicalWord('till'));
    expect(canonicalWord('allright')).toBe(canonicalWord('alright'));
  });

  it('is stable, so canonicalizing twice changes nothing', () => {
    for (const word of ['ok', 'okay', 'grey', 'allright', 'til']) {
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

describe('canonicalWord leaves the speaker in charge of their own sounds', () => {
  it('keeps a contraction distinct from its expansion', () => {
    expect(canonicalWord('gonna')).not.toBe(canonicalWord('goingto'));
    expect(canonicalWord('wanna')).not.toBe(canonicalWord('wantto'));
    expect(canonicalWord('gotta')).not.toBe(canonicalWord('gotto'));
    expect(canonicalWord('kinda')).not.toBe(canonicalWord('kindof'));
    expect(canonicalWord('im')).not.toBe(canonicalWord('iam'));
  });

  it('keeps different words apart even when they mean the same', () => {
    expect(canonicalWord('yep')).not.toBe(canonicalWord('yeah'));
    expect(canonicalWord('yup')).not.toBe(canonicalWord('yeah'));
  });
});
