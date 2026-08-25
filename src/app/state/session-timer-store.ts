import { computed, inject, Injectable, signal } from '@angular/core';
import { formatClock } from '../core/timing';
import { Clock } from '../platform/clock';
import { PracticeStore } from './practice-store';
import { SettingsStore } from './settings-store';

export interface SessionTally {
  readonly spoken: number;
  readonly stars: number | null;
  // Time the countdown actually consumed, so the summary can report what was
  // practised instead of what was planned.
  readonly usedMs: number;
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

  // A session with no time limit has nothing to count down from, so the same
  // signal counts up instead and remainingMs holds time spent, not time left.
  private readonly unlimited = computed(() => this.settings.durationMin() === 0);

  readonly clockText = computed(() => {
    this.ticker();
    const ms = this.unlimited()
      ? this.remainingMs() + this.elapsed()
      : this.remainingMs() - this.elapsed();
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
    this.remainingMs.update((ms) => (this.unlimited() ? ms + used : ms - used));
    this.resumedAt = this.clock.now();
  }

  // Time the session has actually spent playing, live - the open slice is
  // included, so a session ended mid-play does not report zero. A method
  // rather than a computed because elapsed() reads the clock, which no signal
  // tracks; a computed would serve a stale value.
  consumedMs(): number {
    if (this.unlimited()) { return Math.max(0, this.remainingMs() + this.elapsed()); }
    const plannedMs = this.settings.durationMin() * 60_000;
    const left = this.remainingMs() - this.elapsed();
    return Math.min(plannedMs, Math.max(0, plannedMs - left));
  }

  expired(): boolean {
    if (this.unlimited()) { return false; }
    return this.remainingMs() - this.elapsed() <= 0;
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
    const plannedMs = this.settings.durationMin() * 60_000;

    // Both callers stop playback first, which accrues the open slice, so
    // remainingMs is already current here; the live slice is not added again.
    // Clamped because an expired session overshoots zero by up to one tick.
    //
    // This is playing time, not wall-clock: practice_sessions.elapsed_ms counts
    // pauses too, so the two will not match for a session that sat paused. That
    // is deliberate - the summary answers "how long did I practise", the row
    // answers "how long was this session open".
    const usedMs = this.unlimited()
      ? Math.max(0, this.remainingMs())
      : Math.min(plannedMs, Math.max(0, plannedMs - this.remainingMs()));

    const tally: SessionTally = {
      spoken: this.spokenCount(),
      stars: this.starsByLine().size ? this.starsWon() : null,
      usedMs,
    };
    this.reset(this.settings.durationMin());
    return tally;
  }

  private elapsed(): number {
    return this.practice.playing() ? this.clock.now() - this.resumedAt : 0;
  }
}
