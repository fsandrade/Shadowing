import { computed, inject, Injectable, signal } from '@angular/core';
import { CUSTOM_DECK_ID, deckOptions, linesFor } from '../core/deck';
import { type Rng, shuffle } from '../core/shuffle';
import { nextIndex } from '../core/timing';
import { CORPUS_DATA } from './corpus-token';
import { CustomTopicStore } from './custom-topic-store';
import { SettingsStore } from './settings-store';

const FIRST_PAGE = 60;
const PAGE = 60;
const LOOKAHEAD = 10;

@Injectable({ providedIn: 'root' })
export class PracticeStore {
  private readonly corpus = inject(CORPUS_DATA);
  private readonly settings = inject(SettingsStore);
  private readonly custom = inject(CustomTopicStore);

  private readonly order = signal<readonly string[] | null>(null);
  private readonly revealed = signal(FIRST_PAGE);

  readonly index = signal(0);
  readonly playing = signal(false);
  readonly spoken = signal<ReadonlySet<number>>(new Set<number>());

  readonly deckOptions = computed(() => deckOptions(this.corpus));

  readonly customActive = computed(() => this.settings.deckId() === CUSTOM_DECK_ID);

  readonly lines = computed<readonly string[]>(() => {
    const order = this.order();
    if (order) { return order; }
    if (this.customActive()) { return this.custom.lines(); }
    return linesFor(this.corpus, this.settings.deckId());
  });

  readonly visibleLines = computed<readonly string[]>(
    () => this.lines().slice(0, this.revealed()),
  );

  readonly allRevealed = computed(() => this.revealed() >= this.lines().length);

  readonly hasLines = computed(() => this.lines().length > 0);

  selectDeck(id: string): void {
    this.settings.setDeckId(id);
    this.order.set(null);
    this.resetProgress();
  }

  refreshLines(): void {
    this.order.set(null);
    this.resetProgress();
  }

  shuffleLines(rng?: Rng): void {
    this.order.set(shuffle(this.lines(), rng));
    this.resetProgress();
  }

  revealMore(): void {
    if (this.allRevealed()) { return; }
    this.revealed.update((n) => Math.min(n + PAGE, this.lines().length));
  }

  goTo(i: number): void {
    this.index.set(i);
    this.revealThrough(i);
  }

  advance(): void {
    const next = nextIndex(this.index(), this.lines().length);
    this.index.set(next);
    this.revealThrough(next);
  }

  back(): void {
    this.index.set(Math.max(0, this.index() - 1));
  }

  markSpoken(i: number): void {
    const next = new Set(this.spoken());
    next.add(i);
    this.spoken.set(next);
  }

  setPlaying(on: boolean): void {
    this.playing.set(on);
  }

  private revealThrough(i: number): void {
    const needed = Math.min(i + 1 + LOOKAHEAD, this.lines().length);
    if (needed > this.revealed()) { this.revealed.set(needed); }
  }

  private resetProgress(): void {
    this.index.set(0);
    this.spoken.set(new Set<number>());
    this.revealed.set(Math.min(FIRST_PAGE, this.lines().length));
  }
}
