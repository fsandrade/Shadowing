import type { Provider } from '@angular/core';
import type { Catalog, Sentence } from '../core/catalog';
import { SENTENCE_IDS } from '../data/progress-service';

function sentence(id: string, topicId: string, text: string): Sentence {
  return { id, topicId, text };
}

export const TEST_CATALOG: Catalog = {
  loadedAt: '2026-08-06T00:00:00Z',
  topics: [
    { id: 'a', name: 'A' },
    { id: 'b', name: 'B' },
    { id: 'c', name: 'C' },
  ],
  sentences: [
    sentence('s-a1', 'a', 'a1'),
    sentence('s-a2', 'a', 'a2'),
    sentence('s-a3', 'a', 'a3'),
    sentence('s-b1', 'b', 'b1'),
    sentence('s-c1', 'c', 'c1'),
    sentence('s-c2', 'c', 'c2'),
  ],
};

export const NO_SHUFFLE = (): number => 1;

export function storedSettings(
  overrides: Record<string, unknown> = {},
): { read: (key: string) => unknown; write: () => void } {
  const settings = { ...overrides };
  return {
    read: (key: string) => (key === 'shadowing.settings' ? settings : null),
    write: () => {},
  };
}



export function signedOutBackend(): Provider[] {
  return [
    { provide: SENTENCE_IDS, useValue: new Map<string, string>() },
  ];
}
