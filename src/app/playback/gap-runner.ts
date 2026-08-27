import { inject, Injectable, signal } from '@angular/core';
import { Clock, type PendingWait } from '../platform/clock';

const PROGRESS_SAMPLE_MS = 50;

@Injectable({ providedIn: 'root' })
export class GapRunner {
  private readonly clock = inject(Clock);

  private pending: PendingWait | null = null;

  readonly progress = signal(0);
  readonly active = signal(false);

  async run(paceMs: number, until?: Promise<void>): Promise<void> {
    const startedAt = this.clock.ticks();
    this.progress.set(0);
    this.active.set(true);

    this.pending = until ? this.clock.wait(undefined, until) : this.clock.wait(paceMs);

    const sampler = setInterval(() => {
      const p = (this.clock.ticks() - startedAt) / paceMs;
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
