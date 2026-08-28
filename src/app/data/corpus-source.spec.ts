import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { loadContent } from './corpus-source';

interface Result { data: unknown[] | null; error: { message: string } | null; }

function builder(resolve: (range: [number, number] | null) => Result) {
  let range: [number, number] | null = null;
  const chain: Record<string, unknown> = {
    select: () => chain,
    order: () => chain,
    range: (from: number, to: number) => { range = [from, to]; return chain; },
    then: (onFulfilled: (r: Result) => unknown) => Promise.resolve(resolve(range)).then(onFulfilled),
  };
  return chain;
}

function clientWith(tables: Record<string, (range: [number, number] | null) => Result>) {
  return {
    from: (table: string) => builder(tables[table]),
  } as unknown as SupabaseClient;
}

const ok = (data: unknown[]): Result => ({ data, error: null });
const fail = (message: string): Result => ({ data: null, error: { message } });

const LEVELS = [{ id: 'A2', description: 'Elementary' }];

const SEED = 'test-seed';

const DECKS = [
  { id: 'daily-life', description: 'Daily Life' },
  { id: 'travel', description: 'Travel' },
];

describe('loadContent', () => {
  it('maps decks and groups their sentences in order', async () => {
    const { catalog } = await loadContent(clientWith({
      levels: () => ok(LEVELS),
      decks: () => ok(DECKS),
      sentences: () => ok([
        { id: 'id-first', level_id: 'A2', deck_id: 'daily-life', content: 'first' },
        { id: 'id-second', level_id: 'A2', deck_id: 'daily-life', content: 'second' },
        { id: 'id-third', level_id: 'A2', deck_id: 'travel', content: 'third' },
      ]),
    }), SEED);

    expect(catalog.topics.map((d) => d.id)).toEqual(['daily-life', 'travel']);

    expect(catalog.topics[0].name).toBe('Daily Life');
    expect(catalog.sentences.map((s) => s.text)).toEqual(['first', 'second', 'third']);
    expect(catalog.sentences[0].topicId).toBe('daily-life');
    expect(catalog.sentences[0].levelId).toBe('A2');
    expect(catalog.sentences[2].topicId).toBe('travel');
  });

  it('keeps paging until a short page arrives', async () => {
    const ranges: Array<[number, number] | null> = [];
    const { catalog } = await loadContent(clientWith({
      levels: () => ok(LEVELS),
      decks: () => ok(DECKS),
      sentences: (range) => {
        ranges.push(range);
        const from = range?.[0] ?? 0;

        const remaining = Math.max(0, 2500 - from);
        const size = Math.min(1000, remaining);
        return ok(Array.from({ length: size }, (_, i) => ({
          id: `id-${from + i}`,
          level_id: 'A2', deck_id: 'daily-life',
          content: `line ${from + i}`,
        })));
      },
    }), SEED);

    expect(ranges).toEqual([[0, 999], [1000, 1999], [2000, 2999]]);
    expect(catalog.sentences).toHaveLength(2500);
    expect(catalog.sentences[2499].text).toBe('line 2499');
  });

  it('stops paging when the first page is already short', async () => {
    let calls = 0;
    await loadContent(clientWith({
      levels: () => ok(LEVELS),
      decks: () => ok(DECKS),
      sentences: () => {
        calls++;
        return ok([{ id: 'id-only-one', level_id: 'A2', deck_id: 'daily-life', content: 'only one' }]);
      },
    }), SEED);

    expect(calls).toBe(1);
  });

  it('rejects when topics cannot be read', async () => {
    await expect(loadContent(clientWith({
      levels: () => ok(LEVELS),
      decks: () => fail('permission denied for table decks'),
      sentences: () => ok([]),
    }), SEED)).rejects.toThrow(/Could not load topics: permission denied/);
  });

  it('rejects when sentences cannot be read', async () => {
    await expect(loadContent(clientWith({
      levels: () => ok(LEVELS),
      decks: () => ok(DECKS),
      sentences: () => fail('network error'),
    }), SEED)).rejects.toThrow(/Could not load sentences: network error/);
  });

  it('rejects an empty database rather than starting with nothing to practise', async () => {
    await expect(loadContent(clientWith({
      levels: () => ok(LEVELS),
      decks: () => ok([]),
      sentences: () => ok([]),
    }), SEED)).rejects.toThrow(/no sentences/i);
  });

  it('rejects decks that came back with no sentences at all', async () => {
    await expect(loadContent(clientWith({
      levels: () => ok(LEVELS),
      decks: () => ok(DECKS),
      sentences: () => ok([]),
    }), SEED)).rejects.toThrow(/no sentences/i);
  });

  it('keeps a topic that has no sentences of its own', async () => {
    const { catalog } = await loadContent(clientWith({
      levels: () => ok(LEVELS),
      decks: () => ok(DECKS),
      sentences: () => ok([{ id: 'id-only-travel', level_id: 'A2', deck_id: 'travel', content: 'only travel' }]),
    }), SEED);

    expect(catalog.topics.map((t) => t.id)).toEqual(['daily-life', 'travel']);
    expect(catalog.sentences.map((s) => s.text)).toEqual(['only travel']);
  });

  it('indexes every sentence by its text so an attempt can find its row', async () => {
    const { sentenceIds } = await loadContent(clientWith({
      levels: () => ok(LEVELS),
      decks: () => ok(DECKS),
      sentences: () => ok([
        { id: 'id-first', level_id: 'A2', deck_id: 'daily-life', content: 'first' },
        { id: 'id-third', level_id: 'A2', deck_id: 'travel', content: 'third' },
      ]),
    }), SEED);

    expect(sentenceIds.get('first')).toBe('id-first');
    expect(sentenceIds.get('third')).toBe('id-third');
    expect(sentenceIds.get('something the learner typed')).toBeUndefined();
  });

  it('keeps the first id and warns when two sentences share text', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { sentenceIds } = await loadContent(clientWith({
      levels: () => ok(LEVELS),
      decks: () => ok(DECKS),
      sentences: () => ok([
        { id: 'id-a', level_id: 'A2', deck_id: 'daily-life', content: 'same words' },
        { id: 'id-b', level_id: 'A2', deck_id: 'travel', content: 'same words' },
      ]),
    }), SEED);

    expect(sentenceIds.get('same words')).toBe('id-a');
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });

  it('stamps generatedAt in the format the bundled corpus uses', async () => {
    const { catalog } = await loadContent(clientWith({
      levels: () => ok(LEVELS),
      decks: () => ok(DECKS),
      sentences: () => ok([{ id: 'id-x', level_id: 'A2', deck_id: 'travel', content: 'x' }]),
    }), SEED);

    expect(catalog.loadedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
  });
});
