import { computed, inject, Injectable, signal } from '@angular/core';
import { formatClock } from '../core/timing';
import { Clock } from '../platform/clock';
import { PracticeStore } from './practice-store';
import { SettingsStore } from './settings-store';

/**
 * Session accounting. Two modes, both driven by the same two fields:
 *  - durationMin > 0: `remainingMs` counts down from the goal.
 *  - durationMin = 0: `remainingMs` accumulates upward, no limit.
 *
 * `resumedAt` marks the start of the un-banked slice; `accrue()` folds that
 * slice into `remainingMs` whenever playback pauses, so a paused clock does
 * not drift. Whether a live slice counts is decided by `PracticeStore.playing`
 * alone — the vanilla app used one flag for both, and a second flag here could
 * disagree with it.
 */
@Injectable({ providedIn: 'root' })
export class SessionTimerStore {
  private readonly clock = inject(Clock);
  private readonly settings = inject(SettingsStore);
  private readonly practice = inject(PracticeStore);

  private resumedAt = 0;
  /** Bumped by the 250 ms UI tick so `clockText` recomputes. */
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

  /** Call every 250 ms from the UI so the clock text advances. */
  tick(): void {
    this.ticker.update((n) => n + 1);
  }

  /** Starts a new un-banked slice. Call when playback begins. */
  resume(): void {
    this.resumedAt = this.clock.now();
  }

  /**
   * Banks the un-counted slice. Must be called while `playing` is still true —
   * both play() and stop() do so before flipping the flag.
   */
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

  /** Sets a fresh goal (or 0 for unlimited) and clears the tally. */
  reset(minutes: number): void {
    this.resumedAt = this.clock.now();
    this.remainingMs.set(minutes * 60_000);
    this.spokenCount.set(0);
    this.tick();
  }

  countSpoken(): void {
    this.spokenCount.update((n) => n + 1);
  }

  /** Returns the tally for the summary banner, then resets the session. */
  finish(): number {
    const spoken = this.spokenCount();
    this.reset(this.settings.durationMin());
    return spoken;
  }

  private elapsed(): number {
    return this.practice.playing() ? this.clock.now() - this.resumedAt : 0;
  }
}
