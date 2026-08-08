import { describe, expect, it } from 'vitest';
import { formatClock, nextIndex, pauseMs, safetyTimeoutMs } from './timing';

describe('pauseMs', () => {
  it('is the speech duration times the slack', () => {
    expect(pauseMs(1000, 1.5)).toBe(1500);
  });

  it('rounds to whole milliseconds', () => {
    expect(pauseMs(1000, 1.0005)).toBe(1001);
  });

  it('never returns a negative wait', () => {
    expect(pauseMs(1000, -2)).toBe(0);
  });
});

describe('safetyTimeoutMs', () => {
  it('allows the sentence plus a five second margin', () => {
    expect(safetyTimeoutMs('123456789012', 1)).toBe(6000);
  });

  it('grows as the rate slows down', () => {
    expect(safetyTimeoutMs('123456789012', 0.5)).toBeGreaterThan(
      safetyTimeoutMs('123456789012', 1),
    );
  });

  it('still gives an empty string the margin', () => {
    expect(safetyTimeoutMs('', 1)).toBe(5000);
  });
});

describe('nextIndex', () => {
  it('wraps at the end of the list', () => {
    expect(nextIndex(0, 3)).toBe(1);
    expect(nextIndex(2, 3)).toBe(0);
  });

  it('returns 0 for an empty list', () => {
    expect(nextIndex(0, 0)).toBe(0);
  });
});

describe('formatClock', () => {
  it('renders MM:SS', () => {
    expect(formatClock(0)).toBe('00:00');
    expect(formatClock(65)).toBe('01:05');
  });

  it('clamps negatives to zero', () => {
    expect(formatClock(-30)).toBe('00:00');
  });

  it('keeps counting in minutes past an hour', () => {
    expect(formatClock(3661)).toBe('61:01');
  });
});
