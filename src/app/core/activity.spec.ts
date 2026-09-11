import { describe, expect, it } from 'vitest';
import { KINDS, kindById } from './activity';

describe('KINDS', () => {
  it('offers exactly the two practice kinds, in a fixed order', () => {
    expect(KINDS.map((k) => k.id)).toEqual(['speaking', 'dictation']);
  });

  it('only speaking needs the microphone', () => {
    expect(KINDS.every((k) => k.needsMicrophone === (k.id === 'speaking'))).toBe(true);
  });

  it('explains each kind in one line', () => {
    for (const kind of KINDS) {
      expect(kind.blurb.length).toBeGreaterThan(0);
      expect(kind.blurb.trim().endsWith('.')).toBe(true);
    }
  });

  it('resolves kinds by id and returns null for unknown ids', () => {
    expect(kindById('speaking')?.name).toBe('Speaking');
    expect(kindById('dictation')?.name).toBe('Dictation');
    expect(kindById('listening')).toBeNull();
    expect(kindById(null)).toBeNull();
  });
});
