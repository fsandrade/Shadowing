import { computed, inject, Injectable, signal } from '@angular/core';
import { type Level, type Sentence, sentencesAt, type Topic, topicsAt } from '../core/catalog';
import { pacingFor } from '../core/pacing';
import { type Rng, shuffle } from '../core/shuffle';
import { RANDOM } from '../platform/rng';
import { nextIndex } from '../core/timing';
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
  private readonly random = inject(RANDOM);

  private readonly revealed = signal(FIRST_PAGE);
  private readonly reshuffle = signal(0);
  private readonly rng = signal<Rng | undefined>(undefined);

  readonly index = signal(0);
  readonly playing = signal(false);
  readonly spoken = signal<ReadonlySet<number>>(new Set<number>());

  readonly levels = computed<readonly Level[]>(() => this.catalog.levels);

  readonly level = computed<string | null>(() => this.settings.levelId());

  readonly levelChosen = computed(() => this.level() !== null);

  readonly customActive = computed(() => this.settings.source() === 'custom');

  readonly topics = computed<readonly Topic[]>(() => {
    const level = this.level();
    return level ? topicsAt(this.catalog, level) : [];
  });

  readonly topicId = computed(() => this.settings.topicId());

  readonly sentences = computed<readonly Sentence[]>(() => {
    const level = this.level();
    return level ? sentencesAt(this.catalog, level, this.settings.topicId()) : [];
  });

  readonly lines = computed<readonly string[]>(() => {
    if (this.customActive()) { return this.custom.lines(); }
    this.reshuffle();
    return shuffle(this.sentences().map((s) => s.text), this.rng() ?? this.random);
  });

  readonly visibleLines = computed<readonly string[]>(
    () => this.lines().slice(0, this.revealed()),
  );

  readonly allRevealed = computed(() => this.revealed() >= this.lines().length);

  readonly hasLines = computed(() => this.lines().length > 0);

  selectLevel(id: string): void {
    this.settings.setLevelId(id);
    this.settings.setSource('catalog');
    this.applyPacing(id);
    this.resetProgress();
  }

  private applyPacing(levelId: string): void {
    const pacing = pacingFor(levelId);
    this.settings.setRate(pacing.rate);
    this.settings.setSlack(pacing.slack);
  }

  clearLevel(): void {
    this.settings.setLevelId(null);
    this.resetProgress();
  }

  toggleTopic(id: string): void {
    this.settings.setTopicId(this.settings.topicId() === id ? null : id);
    this.settings.setSource('catalog');
    this.resetProgress();
  }

  clearTopic(): void {
    this.settings.setTopicId(null);
    this.resetProgress();
  }

  useCustomText(): void {
    this.settings.setSource('custom');
    this.resetProgress();
  }

  useCatalog(): void {
    this.settings.setSource('catalog');
    this.resetProgress();
  }

  shuffleLines(rng?: Rng): void {
    this.rng.set(rng);
    this.reshuffle.update((n) => n + 1);
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
