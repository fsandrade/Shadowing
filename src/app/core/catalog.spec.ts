import { describe, expect, it } from 'vitest';
import { sentencesIn, topicsIn } from './catalog';

const CATALOG = {
  loadedAt: '2026-08-06T00:00:00Z',
  levels: [{ id: 'A2', description: 'Elementary' }],
  topics: [
    { id: 'a', name: 'A' },
    { id: 'b', name: 'B' },
    { id: 'c', name: 'C' },
  ],
  sentences: [
    { id: 's-a1', topicId: 'a', levelId: 'A2', text: 'a1' },
    { id: 's-a2', topicId: 'a', levelId: 'A2', text: 'a2' },
    { id: 's-b1', topicId: 'b', levelId: 'A2', text: 'b1' },
  ],
};

describe('topicsIn', () => {
  it('returns only topics that have sentences', () => {
    expect(topicsIn(CATALOG)).toEqual([
      { id: 'a', name: 'A' },
      { id: 'b', name: 'B' },
    ]);
  });

  it('drops an empty topic even when it is listed', () => {
    const withEmpty = { ...CATALOG, topics: [...CATALOG.topics, { id: 'c', name: 'C' }] };
    expect(topicsIn(withEmpty).map((t) => t.id)).toEqual(['a', 'b']);
  });
});

describe('sentencesIn', () => {
  it('filters by topic', () => {
    expect(sentencesIn(CATALOG, 'a').map((s) => s.id)).toEqual(['s-a1', 's-a2']);
  });

  it('returns every sentence for null topic', () => {
    expect(sentencesIn(CATALOG, null).map((s) => s.id)).toEqual([
      's-a1', 's-a2', 's-b1',
    ]);
  });

  it('returns nothing for an unknown topic', () => {
    expect(sentencesIn(CATALOG, 'nope')).toEqual([]);
  });
});
