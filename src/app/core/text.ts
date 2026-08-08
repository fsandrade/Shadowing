export function stripTags(html: string): string {
  const s = String(html);
  let depth = 0;
  let out = '';
  for (const ch of s) {
    if (ch === '<') { depth++; continue; }
    if (ch === '>' && depth > 0) { depth--; continue; }
    if (depth === 0) { out += ch; }
  }
  return out;
}
