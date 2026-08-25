export interface Level {
  readonly id: string;
  readonly description: string;
}

export interface Topic {
  readonly id: string;
  readonly name: string;
}

export interface Sentence {
  readonly id: string;
  readonly topicId: string;
  readonly levelId: string;

  readonly text: string;
}

export interface Catalog {
  readonly loadedAt: string;
  readonly levels: readonly Level[];
  readonly topics: readonly Topic[];
  readonly sentences: readonly Sentence[];
}

export function topicsAt(catalog: Catalog, levelId: string): Topic[] {
  const present = new Set(
    catalog.sentences.filter((s) => s.levelId === levelId).map((s) => s.topicId),
  );
  return catalog.topics.filter((t) => present.has(t.id));
}

export function sentencesAt(
  catalog: Catalog,
  levelId: string,
  topicId: string | null,
): Sentence[] {
  return catalog.sentences.filter(
    (s) => s.levelId === levelId && (topicId === null || s.topicId === topicId),
  );
}

export function countAt(catalog: Catalog, levelId: string): number {
  let n = 0;
  for (const sentence of catalog.sentences) {
    if (sentence.levelId === levelId) { n++; }
  }
  return n;
}

export function levelChoices(catalog: Catalog): Array<Level & { count: number }> {
  return catalog.levels.map((level) => ({ ...level, count: countAt(catalog, level.id) }));
}

export function isKnownLevel(catalog: Catalog, levelId: string): boolean {
  return catalog.levels.some((l) => l.id === levelId) && countAt(catalog, levelId) > 0;
}
