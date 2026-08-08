import { inject, Injectable, signal } from '@angular/core';
import { Clock, type PendingWait } from '../platform/clock';

/** How often the gap ring samples its progress. */
const PROGRESS_SAMPLE_MS = 50;

/**
 * The repeat-aloud pause between sentences, and the progress the ring draws.
 *
 * Separate from PlaybackService because this is the only part of playback the
 * UI observes continuously, and because racing an external promise against a
 * timer is self-contained mechanics with nothing to do with transport state.
 */
@Injectable({ providedIn: 'root' })
export class GapRunner {
  private readonly clock = inject(Clock);

  private pending: PendingWait | null = null;

  /** Gap completion, 0 to 1. */
  readonly progress = signal(0);

  /**
   * True for the whole duration of a gap. The ring mounts and unmounts on this
   * rather than on `progress > 0`, so it is present at offset-full from the
   * first frame and visibly drains, as the vanilla ring did.
   */
  readonly active = signal(false);

  /**
   * Waits `gapMs`, or until `until` resolves first — the speech validator uses
   * that to end the pause as soon as the user has finished repeating.
   */
  async run(gapMs: number, until?: Promise<void>): Promise<void> {
    const startedAt = this.clock.ticks();
    this.progress.set(0);
    this.active.set(true);

    this.pending = this.clock.wait(gapMs, until);

    const sampler = setInterval(() => {
      const p = (this.clock.ticks() - startedAt) / gapMs;
      this.progress.set(Math.min(1, Math.max(0, p)));
    }, PROGRESS_SAMPLE_MS);

    try {
      await this.pending.done;
    } finally {
      clearInterval(sampler);
      this.pending = null;
      this.reset();
    }
  }

  /** Ends any gap in flight immediately. Part of playback's cancellation. */
  cancel(): void {
    this.pending?.resolveNow();
    this.pending = null;
    this.reset();
  }

  private reset(): void {
    this.active.set(false);
    this.progress.set(0);
  }
}
