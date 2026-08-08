import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { SafeStorage, STORAGE } from './storage';

function withStorage(impl: Partial<Storage> | null) {
  TestBed.configureTestingModule({
    providers: [{ provide: STORAGE, useValue: impl as unknown as Storage | null }],
  });
  return TestBed.inject(SafeStorage);
}

describe('SafeStorage', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('round-trips a JSON value', () => {
    const map = new Map<string, string>();
    const s = withStorage({
      getItem: (k) => map.get(k) ?? null,
      setItem: (k, v) => void map.set(k, v),
    });
    s.write('k', { a: 1 });
    expect(s.read<{ a: number }>('k')).toEqual({ a: 1 });
  });

  it('returns null for a missing key', () => {
    expect(withStorage({ getItem: () => null }).read('nope')).toBeNull();
  });

  it('returns null for unparseable JSON instead of throwing', () => {
    expect(withStorage({ getItem: () => '{not json' }).read('k')).toBeNull();
  });

  it('swallows a throwing setItem (private mode)', () => {
    const s = withStorage({
      getItem: () => null,
      setItem: () => { throw new Error('QuotaExceeded'); },
    });
    expect(() => s.write('k', 1)).not.toThrow();
  });

  it('swallows a throwing getItem', () => {
    const s = withStorage({ getItem: () => { throw new Error('blocked'); } });
    expect(s.read('k')).toBeNull();
  });

  it('reads null when no storage is available at all', () => {
    const s = withStorage(null);
    expect(s.read('k')).toBeNull();
    expect(() => s.write('k', 1)).not.toThrow();
  });
});
