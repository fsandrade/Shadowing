import type { Catalog, Sentence, Topic } from '../core/catalog';
import { CORPUS } from './corpus';
import { DECKS, SENTENCE_META } from './corpus-meta';

export type SentenceIds = ReadonlyMap<string, string>;

export interface Content {
  readonly catalog: Catalog;
  readonly sentenceIds: SentenceIds;
}

function stamp(): string {
  return `${new Date().toISOString().slice(0, 19)}Z`;
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



export function loadContent(seed: string): Content {
  const sentenceIds = new Map<string, string>();
  const sentences: Sentence[] = [];

  for (const deck of DECKS) {
    const deckSentences = CORPUS.decks.find((d) => d.id === deck.id)?.lines ?? [];
    for (const content of deckSentences) {
      const meta = SENTENCE_META.get(content);
      if (!meta) {
        throw new Error(`No metadata for sentence in deck "${deck.id}": ${content}`);
      }
      sentences.push({
        id: meta.id,
        topicId: meta.deckId,
        text: content,
      });
      sentenceIds.set(content, meta.id);
    }
  }

  if (!sentences.length) {
    throw new Error('The bundled corpus has no sentences.');
  }

  
  
  sentences.sort((a, b) => hashOrder(a.id, seed) - hashOrder(b.id, seed));

  const topics: Topic[] = DECKS.map((d) => ({ id: d.id, name: d.name }));

  return {
    catalog: { loadedAt: stamp(), topics, sentences },
    sentenceIds,
  };
}
