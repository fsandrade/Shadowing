import { computed, inject, Injectable, signal } from '@angular/core';
import { type Sentence, sentencesIn, type Topic, topicsIn } from '../core/catalog';
import { buildQueue } from '../core/progression';
import { type Rng } from '../core/shuffle';
import { RANDOM } from '../platform/rng';
import { nextIndex } from '../core/timing';
import { HistoryService } from '../data/history-service';
import { CATALOG } from './catalog-token';
import { CustomTopicStore } from './custom-topic-store';
import { SettingsStore } from './settings-store';

const FIRST_PAGE = 60;
const PAGE = 60;
const LOOKAHEAD = 10;

@Injectable({ providedIn: 'root' })
export class PracticeStore {
  private readonly catalog = inject(CATALOG);
  private readonly settings = inject(SettingsStore);
  private readonly custom = inject(CustomTopicStore);
  private readonly history = inject(HistoryService);
  private readonly random = inject(RANDOM);

  private readonly revealed = signal(FIRST_PAGE);
  private readonly rng = signal<Rng | undefined>(undefined);
  private readonly queue = signal<readonly Sentence[]>([]);

  readonly index = signal(0);
  readonly playing = signal(false);
  readonly spoken = signal<ReadonlySet<number>>(new Set<number>());

  constructor() {
    this.rebuildQueue();
  }



  
  
  
  
  readonly customActive = computed(() => this.settings.source() === 'custom');

  
  
  readonly topics = computed<readonly Topic[]>(() => topicsIn(this.catalog));

  readonly topicId = computed(() => this.settings.topicId());

  readonly sentences = computed<readonly Sentence[]>(() => {
    return sentencesIn(this.catalog, this.settings.topicId());
  });

  readonly lines = computed<readonly string[]>(() => {
    if (this.customActive()) { return this.custom.lines(); }
    return this.queue().map((s) => s.text);
  });

  readonly visibleLines = computed<readonly string[]>(
    () => this.lines().slice(0, this.revealed()),
  );

  readonly allRevealed = computed(() => this.revealed() >= this.lines().length);

  readonly hasLines = computed(() => this.lines().length > 0);

  
  
  selectTopic(id: string | null): void {
    this.settings.setTopicId(id);
    this.settings.setSource('catalog');
    this.rebuildQueue();
    this.resetProgress();
  }

  useCustomText(): void {
    this.settings.setSource('custom');
    this.resetProgress();
  }

  shuffleLines(rng?: Rng): void {
    this.rng.set(rng);
    this.rebuildQueue();
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

  private rebuildQueue(): void {
    this.queue.set(buildQueue(
      this.sentences(),
      this.history.progress(),
      this.rng() ?? this.random,
    ));
  }

  private resetProgress(): void {
    this.index.set(0);
    this.spoken.set(new Set<number>());
    this.revealed.set(Math.min(FIRST_PAGE, this.lines().length));
  }
}
