import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Clock } from './clock';

describe('Clock', () => {
  let clock: Clock;

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.resetTestingModule();
    clock = TestBed.inject(Clock);
  });

  afterEach(() => vi.useRealTimers());

  it('resolves after the requested delay', async () => {
    const pending = clock.wait(500);
    let settled = false;
    void pending.done.then(() => { settled = true; });

    await vi.advanceTimersByTimeAsync(499);
    expect(settled).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    expect(settled).toBe(true);
  });

  it('resolveNow settles early and cancels the timer', async () => {
    const pending = clock.wait(5000);
    let settled = false;
    void pending.done.then(() => { settled = true; });

    pending.resolveNow();
    await Promise.resolve();
    expect(settled).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('resolves when the `until` promise wins the race', async () => {
    let release!: () => void;
    const until = new Promise<void>((r) => { release = r; });
    const pending = clock.wait(5000, until);
    let settled = false;
    void pending.done.then(() => { settled = true; });

    release();
    await vi.advanceTimersByTimeAsync(0);
    expect(settled).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('ignores a late `until` once the timer already fired', async () => {
    let release!: () => void;
    const until = new Promise<void>((r) => { release = r; });
    const pending = clock.wait(100, until);
    let count = 0;
    void pending.done.then(() => { count++; });

    await vi.advanceTimersByTimeAsync(100);
    release();
    await vi.advanceTimersByTimeAsync(0);
    expect(count).toBe(1);
  });

  it('resolveNow after settling is a no-op', async () => {
    const pending = clock.wait(10);
    let count = 0;
    void pending.done.then(() => { count++; });
    await vi.advanceTimersByTimeAsync(10);
    pending.resolveNow();
    await Promise.resolve();
    expect(count).toBe(1);
  });

  it('now() and ticks() report advancing time', async () => {
    const t0 = clock.now();
    const p0 = clock.ticks();
    await vi.advanceTimersByTimeAsync(1000);
    expect(clock.now() - t0).toBe(1000);
    expect(clock.ticks() - p0).toBe(1000);
  });
});
