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
    .order('position');

  if (error) { throw new Error(`Could not load topics: ${error.message}`); }
  return (data ?? []) as DeckRow[];
}

async function fetchSentences(client: SupabaseClient): Promise<SentenceRow[]> {
  const rows: SentenceRow[] = [];

  for (let from = 0; ; from += PAGE) {
    const { data, error } = await client
      .from('sentences')
      .select('id, deck_id, level_id, content')
      .order('deck_id')
      .order('position')
      .range(from, from + PAGE - 1);

    if (error) { throw new Error(`Could not load sentences: ${error.message}`); }

    const page = (data ?? []) as SentenceRow[];
    rows.push(...page);
    if (page.length < PAGE) { return rows; }
  }
}

export async function loadContent(client: SupabaseClient): Promise<Content> {
  const [levelRows, topicRows, sentenceRows] = await Promise.all([
    fetchLevels(client),
    fetchTopics(client),
    fetchSentences(client),
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
