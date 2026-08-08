import { computed, inject, Injectable, signal } from '@angular/core';
import { formatClock } from '../core/timing';
import { Clock } from '../platform/clock';
import { PracticeStore } from './practice-store';
import { SettingsStore } from './settings-store';

export interface SessionTally {
  readonly spoken: number;
  readonly stars: number | null;
}

@Injectable({ providedIn: 'root' })
export class SessionTimerStore {
  private readonly clock = inject(Clock);
  private readonly settings = inject(SettingsStore);
  private readonly practice = inject(PracticeStore);

  private resumedAt = 0;
  private readonly ticker = signal(0);
  private readonly practised = signal<ReadonlySet<number>>(new Set<number>());
  private readonly starsByLine = signal<ReadonlyMap<number, number>>(new Map());

  readonly remainingMs = signal(0);

  readonly spokenCount = computed(() => this.practised().size);

  readonly starsWon = computed(() => {
    let total = 0;
    for (const stars of this.starsByLine().values()) { total += stars; }
    return total;
  });

  readonly clockText = computed(() => {
    this.ticker();
    const elapsed = this.elapsed();
    const ms = this.settings.durationMin() > 0
      ? this.remainingMs() - elapsed
      : this.remainingMs() + elapsed;
    return formatClock(ms / 1000);
  });

  tick(): void {
    this.ticker.update((n) => n + 1);
  }

  resume(): void {
    this.resumedAt = this.clock.now();
  }

  accrue(): void {
    if (!this.practice.playing()) { return; }
    const used = this.clock.now() - this.resumedAt;
    this.remainingMs.update((ms) =>
      this.settings.durationMin() > 0 ? ms - used : ms + used,
    );
    this.resumedAt = this.clock.now();
  }

  expired(): boolean {
    return this.settings.durationMin() > 0
      && this.remainingMs() - this.elapsed() <= 0;
  }

  reset(minutes: number): void {
    this.resumedAt = this.clock.now();
    this.remainingMs.set(minutes * 60_000);
    this.practised.set(new Set<number>());
    this.starsByLine.set(new Map());
    this.tick();
  }

  countSpoken(lineIndex: number): void {
    if (this.practised().has(lineIndex)) { return; }
    const next = new Set(this.practised());
    next.add(lineIndex);
    this.practised.set(next);
  }

  recordStars(lineIndex: number, stars: number): void {
    if (!this.practised().has(lineIndex)) { return; }
    const next = new Map(this.starsByLine());
    next.set(lineIndex, stars);
    this.starsByLine.set(next);
  }

  finish(): SessionTally {
    const tally: SessionTally = {
      spoken: this.spokenCount(),
      stars: this.starsByLine().size ? this.starsWon() : null,
    };
    this.reset(this.settings.durationMin());
    return tally;
  }

  private elapsed(): number {
    return this.practice.playing() ? this.clock.now() - this.resumedAt : 0;
  }
}
