export interface Deck {
  readonly id: string;
  readonly name: string;
  readonly lines: readonly string[];
}

export interface Corpus {
  readonly generatedAt: string;
  readonly decks: readonly Deck[];
}

export interface DeckOption {
  readonly id: string;
  readonly name: string;
  readonly count: number;
}

export const ALL_DECK_ID = 'all';

export function deckOptions(corpus: Corpus): DeckOption[] {
  const decks = corpus?.decks ?? [];
  const total = decks.reduce((n, d) => n + d.lines.length, 0);
  return [
    { id: ALL_DECK_ID, name: 'All', count: total },
    ...decks.map((d) => ({ id: d.id, name: d.name, count: d.lines.length })),
  ];
}

export function linesFor(corpus: Corpus, deckId: string): string[] {
  const decks = corpus?.decks ?? [];
  if (deckId === ALL_DECK_ID) {
    return decks.flatMap((d) => [...d.lines]);
  }
  const deck = decks.find((d) => d.id === deckId);
  return deck ? [...deck.lines] : [];
}
