import { computed, inject, Injectable, signal } from '@angular/core';
import { deckOptions, linesFor } from '../core/deck';
import { type Rng, shuffle } from '../core/shuffle';
import { nextIndex } from '../core/timing';
import { CORPUS_DATA } from './corpus-token';
import { SettingsStore } from './settings-store';

/**
 * Transient practice state. The selected deck itself lives in SettingsStore
 * because it persists; `lines` is derived from it plus any active shuffle.
 */
@Injectable({ providedIn: 'root' })
export class PracticeStore {
  private readonly corpus = inject(CORPUS_DATA);
  private readonly settings = inject(SettingsStore);

  /** A shuffled snapshot, or null for the corpus's natural order. */
  private readonly order = signal<readonly string[] | null>(null);

  readonly index = signal(0);
  readonly playing = signal(false);
  readonly spoken = signal<ReadonlySet<number>>(new Set<number>());

  readonly deckOptions = computed(() => deckOptions(this.corpus));

  readonly lines = computed<readonly string[]>(
    () => this.order() ?? linesFor(this.corpus, this.settings.deckId()),
  );

  readonly hasLines = computed(() => this.lines().length > 0);

  /** Resets position and progress, mirroring the old full renderLines(). */
  selectDeck(id: string): void {
    this.settings.setDeckId(id);
    this.order.set(null);
    this.resetProgress();
  }

  shuffleLines(rng?: Rng): void {
    this.order.set(shuffle(this.lines(), rng));
    this.resetProgress();
  }

  goTo(i: number): void {
    this.index.set(i);
  }

  advance(): void {
    this.index.set(nextIndex(this.index(), this.lines().length));
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

  private resetProgress(): void {
    this.index.set(0);
    this.spoken.set(new Set<number>());
  }
}
