import type { SupabaseClient } from '@supabase/supabase-js';
import type { Catalog, Level, Sentence, Topic } from '../core/catalog';

interface LevelRow { readonly id: string; readonly description: string; }
interface DeckRow { readonly id: string; readonly description: string; }
interface SentenceRow {
  readonly id: string;
  readonly deck_id: string;
  readonly level_id: string;
  readonly content: string;
}

export type SentenceIds = ReadonlyMap<string, string>;

export interface Content {
  readonly catalog: Catalog;
  readonly sentenceIds: SentenceIds;
}

const PAGE = 1000;

function stamp(): string {
  return `${new Date().toISOString().slice(0, 19)}Z`;
}

async function fetchLevels(client: SupabaseClient): Promise<LevelRow[]> {
  const { data, error } = await client
    .from('levels')
    .select('id, description')
    .order('id');

  if (error) { throw new Error(`Could not load levels: ${error.message}`); }
  return (data ?? []) as LevelRow[];
}

async function fetchTopics(client: SupabaseClient): Promise<DeckRow[]> {
  const { data, error } = await client
    .from('decks')
    .select('id, description')
    .order('description');

  if (error) { throw new Error(`Could not load topics: ${error.message}`); }
  return (data ?? []) as DeckRow[];
}

function hashOrder(id: string, seed: string): number {
  let h = 0x811c9dc5;
  const s = `${id}${seed}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

async function fetchSentences(
  client: SupabaseClient,
  seed: string,
): Promise<SentenceRow[]> {
  const rows: SentenceRow[] = [];

  // PostgREST can't order by an expression, so fetch all rows and sort
  // client-side. Stable-per-session random order: hash(id || seed) re-orders
  // every session but is constant for a given seed.
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await client
      .from('sentences')
      .select('id, deck_id, level_id, content')
      .range(from, from + PAGE - 1);

    if (error) { throw new Error(`Could not load sentences: ${error.message}`); }

    const page = (data ?? []) as SentenceRow[];
    rows.push(...page);
    if (page.length < PAGE) { break; }
  }

  rows.sort((a, b) => hashOrder(a.id, seed) - hashOrder(b.id, seed));
  return rows;
}

export async function loadContent(
  client: SupabaseClient,
  seed: string,
): Promise<Content> {
  const [levelRows, topicRows, sentenceRows] = await Promise.all([
    fetchLevels(client),
    fetchTopics(client),
    fetchSentences(client, seed),
  ]);

  if (!levelRows.length) {
    throw new Error('Supabase returned no levels. Has the seed been applied?');
  }
  if (!sentenceRows.length) {
    throw new Error('Supabase returned no sentences. Has the seed been applied?');
  }

  const sentenceIds = new Map<string, string>();
  const sentences: Sentence[] = [];

  for (const row of sentenceRows) {
    sentences.push({
      id: row.id,
      topicId: row.deck_id,
      levelId: row.level_id,
      text: row.content,
    });

    if (sentenceIds.has(row.content)) {
      console.warn(`Two sentences share the same text; progress on it may be attributed to either: ${row.content}`);
    } else {
      sentenceIds.set(row.content, row.id);
    }
  }

  const levels: Level[] = levelRows.map((l) => ({ id: l.id, description: l.description }));
  const topics: Topic[] = topicRows.map((t) => ({ id: t.id, name: t.description }));

  return {
    catalog: { loadedAt: stamp(), levels, topics, sentences },
    sentenceIds,
  };
}
