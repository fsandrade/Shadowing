export interface Topic {
  readonly id: string;
  readonly name: string;
}

export interface Sentence {
  readonly id: string;
  readonly topicId: string;
  readonly text: string;
}

export interface Catalog {
  readonly loadedAt: string;
  readonly topics: readonly Topic[];
  readonly sentences: readonly Sentence[];
}

export function topicsIn(catalog: Catalog): Topic[] {
  const present = new Set(catalog.sentences.map((s) => s.topicId));
  return catalog.topics.filter((t) => present.has(t.id));
}

export function sentencesIn(catalog: Catalog, topicId: string | null): Sentence[] {
  return catalog.sentences.filter((s) => topicId === null || s.topicId === topicId);
}
