import { describe, expect, it } from 'vitest';
import { parseJson3Captions } from '../supabase/functions/youtube-transcript/parse';

describe('parseJson3Captions', () => {
  it('pulls text and start times out of json3 caption events', () => {
    const json = {
      events: [
        { tStartMs: 0, segs: [{ utf8: 'Once upon' }, { utf8: ' a time,' }] },
        { tStartMs: 1200, segs: [{ utf8: 'in a kingdom.' }] },
      ],
    };
    expect(parseJson3Captions(json)).toEqual([
      { start: 0, text: 'Once upon a time,' },
      { start: 1.2, text: 'in a kingdom.' },
    ]);
  });

  it('skips events without segments or text', () => {
    expect(parseJson3Captions({ events: [{ tStartMs: 0 }, { tStartMs: 10, segs: [{ utf8: '' }] }] }))
      .toEqual([]);
  });

  it('is empty for a missing events array', () => {
    expect(parseJson3Captions({})).toEqual([]);
    expect(parseJson3Captions(null)).toEqual([]);
  });
});
