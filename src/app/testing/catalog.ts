import type { Catalog, Sentence } from '../core/catalog';

function sentence(id: string, topicId: string, levelId: string, text: string): Sentence {
  return { id, topicId, levelId, text };
}

export const TEST_CATALOG: Catalog = {
  loadedAt: '2026-08-06T00:00:00Z',
  levels: [
    { id: 'A2', description: 'Elementary' },
    { id: 'B1', description: 'Intermediate' },
    { id: 'C2', description: 'Proficient' },
  ],
  topics: [
    { id: 'a', name: 'A' },
    { id: 'b', name: 'B' },
    { id: 'c', name: 'C' },
  ],
  sentences: [
    sentence('s-a1', 'a', 'A2', 'a1'),
    sentence('s-a2', 'a', 'A2', 'a2'),
    sentence('s-a3', 'a', 'A2', 'a3'),
    sentence('s-b1', 'b', 'A2', 'b1'),
    sentence('s-c1', 'c', 'B1', 'c1'),
    sentence('s-c2', 'c', 'B1', 'c2'),
  ],
};

export const TEST_LEVEL = 'A2';

export const TEST_LINES = ['a1', 'a2', 'a3', 'b1'];

export const NO_SHUFFLE = (): number => 1;

export function storedSettings(
  overrides: Record<string, unknown> = {},
): { read: (key: string) => unknown; write: () => void } {
  const settings = { levelId: TEST_LEVEL, ...overrides };
  return {
    read: (key: string) => (key === 'shadowing.settings' ? settings : null),
    write: () => {},
  };
}
