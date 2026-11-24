import { Injectable } from '@angular/core';

const INVISIBLE = /[^\P{C}\n\t]/gu;
const DROP_WITH_CONTENT = new Set([
  'BASE',
  'BUTTON',
  'EMBED',
  'FORM',
  'IFRAME',
  'INPUT',
  'LINK',
  'META',
  'NOSCRIPT',
  'OBJECT',
  'OPTION',
  'SCRIPT',
  'SELECT',
  'STYLE',
  'SVG',
  'TEMPLATE',
  'TEXTAREA',
]);

function plainText(node: Node): string {
  if (node.nodeType === 3) { return node.nodeValue ?? ''; }
  if (node.nodeType !== 1) { return ''; }

  const element = node as Element;
  if (DROP_WITH_CONTENT.has(element.tagName.toUpperCase())) { return ''; }

  let text = '';
  for (const child of Array.from(element.childNodes)) { text += plainText(child); }
  return text;
}

@Injectable({ providedIn: 'root' })
export class TextSanitizer {
  toPlainText(input: unknown): string {
    const raw = typeof input === 'string' ? input : '';
    if (!raw) { return ''; }

    const template = document.createElement('template');
    template.innerHTML = raw;
    let text = '';
    for (const child of Array.from(template.content.childNodes)) { text += plainText(child); }
    return text.normalize('NFC').replace(INVISIBLE, '');
  }
}
