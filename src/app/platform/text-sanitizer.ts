import { Injectable } from '@angular/core';
import DOMPurify from 'dompurify';

const INVISIBLE = /[^\P{C}\n\t]/gu;

@Injectable({ providedIn: 'root' })
export class TextSanitizer {
  toPlainText(input: unknown): string {
    const raw = typeof input === 'string' ? input : '';
    if (!raw) { return ''; }
    const fragment = DOMPurify.sanitize(raw, {
      ALLOWED_TAGS: [],
      ALLOWED_ATTR: [],
      KEEP_CONTENT: true,
      RETURN_DOM_FRAGMENT: true,
    });
    return (fragment.textContent ?? '').normalize('NFC').replace(INVISIBLE, '');
  }
}
