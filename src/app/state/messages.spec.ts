import { describe, expect, it } from 'vitest';
import { MESSAGES } from './messages';

describe('sessionSummary', () => {
  it('leaves stars out when the validator was not used', () => {
    expect(MESSAGES.sessionSummary(5, 12, null))
      .toBe('Session complete: 5 min · 12 sentences repeated.');
  });

  it('adds the stars won when the validator was used', () => {
    expect(MESSAGES.sessionSummary(5, 12, 47))
      .toBe('Session complete: 5 min · 12 sentences repeated · 47 stars won.');
  });

  it('says zero stars rather than hiding them', () => {
    expect(MESSAGES.sessionSummary(5, 3, 0))
      .toBe('Session complete: 5 min · 3 sentences repeated · 0 stars won.');
  });

  it('uses the singular for one sentence and one star', () => {
    expect(MESSAGES.sessionSummary(1, 1, 1))
      .toBe('Session complete: 1 min · 1 sentence repeated · 1 star won.');
  });
});
