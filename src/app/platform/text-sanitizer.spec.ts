import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { TextSanitizer } from './text-sanitizer';

const ZERO_WIDTH = String.fromCharCode(0x200b);
const BELL = String.fromCharCode(0x07);
const BIDI_OVERRIDE = String.fromCharCode(0x202e);

let sanitizer: TextSanitizer;

beforeEach(() => {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({});
  sanitizer = TestBed.inject(TextSanitizer);
});

describe('TextSanitizer removes active content', () => {
  it('drops script tags and their contents', () => {
    expect(sanitizer.toPlainText('<script>alert(1)</script>hello')).toBe('hello');
  });

  it('drops event-handler attributes along with the element', () => {
    expect(sanitizer.toPlainText('<img src=x onerror=alert(1)>Look at this.'))
      .toBe('Look at this.');
  });

  it('drops javascript: links but keeps the visible words', () => {
    expect(sanitizer.toPlainText('Click <a href="javascript:alert(1)">here</a>.'))
      .toBe('Click here.');
  });

  it('drops script nested inside svg', () => {
    expect(sanitizer.toPlainText('<svg><script>alert(1)</script></svg>Done.')).toBe('Done.');
  });

  it('drops style and iframe payloads', () => {
    expect(sanitizer.toPlainText('<style>body{display:none}</style>Styled.')).toBe('Styled.');
    expect(sanitizer.toPlainText('<iframe src="evil"></iframe>After.')).toBe('After.');
  });

  it('unwraps formatting tags so no markup survives', () => {
    const out = sanitizer.toPlainText('<b>Bold</b> and <i>italic</i> text.');
    expect(out).toBe('Bold and italic text.');
    expect(out).not.toContain('<');
  });
});

describe('TextSanitizer preserves what the learner typed', () => {
  it('decodes entities so speech does not read them literally', () => {
    expect(sanitizer.toPlainText('R&D spends 5 &amp; 6.')).toBe('R&D spends 5 & 6.');
  });

  it('keeps comparison characters as plain text', () => {
    expect(sanitizer.toPlainText('Math: a < b and c > d.')).toBe('Math: a < b and c > d.');
  });

  it('keeps paragraph breaks so sentences can be split', () => {
    expect(sanitizer.toPlainText('Line one.\n\nLine two.')).toBe('Line one.\n\nLine two.');
  });
});

describe('TextSanitizer normalises invisible characters', () => {
  it('strips zero-width characters that would break word matching', () => {
    expect(sanitizer.toPlainText(`Zero${ZERO_WIDTH}width here.`)).toBe('Zerowidth here.');
  });

  it('strips control characters', () => {
    expect(sanitizer.toPlainText(`Bell${BELL} here.`)).toBe('Bell here.');
  });

  it('strips bidi overrides that could reverse displayed text', () => {
    expect(sanitizer.toPlainText(`safe${BIDI_OVERRIDE}txet`)).toBe('safetxet');
  });

  it('keeps tabs and newlines', () => {
    expect(sanitizer.toPlainText('a\tb\nc')).toBe('a\tb\nc');
  });
});

describe('TextSanitizer input guarding', () => {
  it('treats non-strings as empty', () => {
    expect(sanitizer.toPlainText(null)).toBe('');
    expect(sanitizer.toPlainText(undefined)).toBe('');
    expect(sanitizer.toPlainText(42)).toBe('');
    expect(sanitizer.toPlainText({ toString: () => '<script>x</script>' })).toBe('');
  });
});
