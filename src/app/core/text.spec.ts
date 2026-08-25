import { describe, expect, it } from 'vitest';
import { stripTags } from './text';

describe('stripTags', () => {
  it('removes the chunk highlight and leaves the sentence', () => {
    expect(stripTags("I must've <b>hit the snooze button</b> like four times."))
      .toBe("I must've hit the snooze button like four times.");
  });

  it('is a no-op on plain text', () => {
    expect(stripTags('no markup here')).toBe('no markup here');
  });

  it('keeps stripping when a tag straddles another tag', () => {
    const out = stripTags('<sc<script>ript>alert(1)</sc<script>ript>');
    expect(out).not.toContain('<');
    expect(out).not.toContain('>');
    expect(out.toLowerCase()).not.toContain('script');
  });
});
