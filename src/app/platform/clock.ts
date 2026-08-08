import { Injectable } from '@angular/core';

export interface PendingWait {
  /** Settles once, whichever of delay / `until` / `resolveNow` comes first. */
  readonly done: Promise<void>;
  /** Ends the wait immediately. Used by the playback loop's cancellation. */
  resolveNow(): void;
}

/**
 * The single source of time for the app. Injected so the playback loop and the
 * session timer can be driven by fake timers instead of real ones.
 */
@Injectable({ providedIn: 'root' })
export class Clock {
  /** Wall clock, for session accounting. */
  now(): number {
    return Date.now();
  }

  /** Monotonic, for measuring how long an utterance actually took. */
  ticks(): number {
    return performance.now();
  }

  /**
   * Waits `ms`, unless `until` resolves first (the speech-validator race) or
   * `resolveNow()` is called (a transport control interrupting the gap).
   */
  wait(ms: number, until?: Promise<void>): PendingWait {
    let settle!: () => void;
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const done = new Promise<void>((resolve) => {
      settle = () => {
        if (settled) { return; }
        settled = true;
        clearTimeout(timer);
        resolve();
      };
    });

    timer = setTimeout(settle, ms);
    void until?.then(settle);

    return { done, resolveNow: settle };
  }
}
