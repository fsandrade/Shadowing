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
}

export const ALL_DECK_ID = 'all';
export const CUSTOM_DECK_ID = 'custom';

export function deckOptions(corpus: Corpus): DeckOption[] {
  const decks = corpus?.decks ?? [];
  return [
    { id: ALL_DECK_ID, name: 'All' },
    { id: CUSTOM_DECK_ID, name: 'My text' },
    ...decks.map((d) => ({ id: d.id, name: d.name })),
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
