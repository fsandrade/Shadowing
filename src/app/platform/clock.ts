import { Injectable } from '@angular/core';

export interface PendingWait {
  readonly done: Promise<void>;

  resolveNow(): void;
}

@Injectable({ providedIn: 'root' })
export class Clock {
  now(): number {
    return Date.now();
  }

  ticks(): number {
    return performance.now();
  }

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

  every(ms: number, fn: () => void): () => void {
    const id = setInterval(fn, ms);
    return () => clearInterval(id);
  }

  waitFor(until: Promise<void>): PendingWait {
    let settle!: () => void;
    let settled = false;

    const done = new Promise<void>((resolve) => {
      settle = () => {
        if (settled) { return; }
        settled = true;
        resolve();
      };
    });

    void until.then(settle);

    return { done, resolveNow: settle };
  }
}
