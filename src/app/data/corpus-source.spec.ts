import { describe, expect, it } from 'vitest';
import { loadContent } from './corpus-source';

const SEED = 'test-seed';

describe('loadContent', () => {
  it('builds topics and sentences from the bundled corpus, with no level metadata', async () => {
    const { catalog } = await loadContent(SEED);

    expect('levels' in catalog).toBe(false);
    expect(catalog.topics.length).toBeGreaterThan(0);
    expect(catalog.sentences.length).toBeGreaterThan(0);

    for (const sentence of catalog.sentences) {
      expect(sentence.id).toBeTruthy();
      expect(sentence.topicId).toBeTruthy();
      expect('levelId' in sentence).toBe(false);
      expect(sentence.text).toBeTruthy();
    }
  });

  it('indexes every sentence by its text', async () => {
    const { catalog, sentenceIds } = await loadContent(SEED);

    for (const sentence of catalog.sentences) {
      expect(sentenceIds.get(sentence.text)).toBe(sentence.id);
    }
  });

  it('orders sentences deterministically per seed', async () => {
    const { catalog: a } = await loadContent(SEED);
    const { catalog: b } = await loadContent(SEED);
    const { catalog: c } = await loadContent('another-seed');

    expect(a.sentences.map((s) => s.text)).toEqual(b.sentences.map((s) => s.text));
    expect(c.sentences.map((s) => s.text)).not.toEqual(a.sentences.map((s) => s.text));
  });

  it('stamps generatedAt in the format the bundled corpus uses', async () => {
    const { catalog } = await loadContent(SEED);
    expect(catalog.loadedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
  });
});
