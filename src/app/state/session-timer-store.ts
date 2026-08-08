import { computed, inject, Injectable, signal } from '@angular/core';
import { formatClock } from '../core/timing';
import { Clock } from '../platform/clock';
import { PracticeStore } from './practice-store';
import { SettingsStore } from './settings-store';

@Injectable({ providedIn: 'root' })
export class SessionTimerStore {
  private readonly clock = inject(Clock);
  private readonly settings = inject(SettingsStore);
  private readonly practice = inject(PracticeStore);

  private resumedAt = 0;

  private readonly ticker = signal(0);

  readonly remainingMs = signal(0);
  readonly spokenCount = signal(0);

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
    this.spokenCount.set(0);
    this.tick();
  }

  countSpoken(): void {
    this.spokenCount.update((n) => n + 1);
  }

  finish(): number {
    const spoken = this.spokenCount();
    this.reset(this.settings.durationMin());
    return spoken;
  }

  private elapsed(): number {
    return this.practice.playing() ? this.clock.now() - this.resumedAt : 0;
  }
}
