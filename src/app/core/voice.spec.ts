import { describe, expect, it } from 'vitest';
import { hasEnglishVoice, pickVoice, type VoiceLike } from './voice';

const v = (name: string, lang: string): VoiceLike => ({ name, lang });

const VOICES = [
  v('Maria', 'pt-BR'),
  v('Aria Natural', 'en-US'),
  v('David', 'en-US'),
  v('Sonia', 'en-GB'),
];

describe('pickVoice', () => {
  it('honours a remembered voice by name', () => {
    expect(pickVoice(VOICES, 'Sonia')?.name).toBe('Sonia');
  });

  it('falls through when the remembered voice is gone', () => {
    expect(pickVoice(VOICES, 'Nobody')?.name).toBe('Aria Natural');
  });

  it('prefers a Natural en-US voice', () => {
    expect(pickVoice(VOICES)?.name).toBe('Aria Natural');
  });

  it('falls back to any en-US voice', () => {
    expect(pickVoice([v('Maria', 'pt-BR'), v('David', 'en-US')])?.name).toBe('David');
  });

  it('falls back to any English voice', () => {
    expect(pickVoice([v('Maria', 'pt-BR'), v('Sonia', 'en-GB')])?.name).toBe('Sonia');
  });

  it('falls back to the first voice when no English one exists', () => {
    expect(pickVoice([v('Maria', 'pt-BR'), v('Ines', 'pt-PT')])?.name).toBe('Maria');
  });

  it('returns null when there are no voices at all', () => {
    expect(pickVoice([])).toBeNull();
  });
});

describe('hasEnglishVoice', () => {
  it('detects the presence of an en-* voice', () => {
    expect(hasEnglishVoice(VOICES)).toBe(true);
    expect(hasEnglishVoice([v('Maria', 'pt-BR')])).toBe(false);
    expect(hasEnglishVoice([])).toBe(false);
  });
});
