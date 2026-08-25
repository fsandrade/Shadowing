import { split, SentenceSplitterSyntax } from 'sentence-splitter';

export const CUSTOM_TEXT_LIMIT = 20000;

const SPEAKABLE = /[\p{L}\p{N}]/u;

export function splitSentences(text: string): string[] {
  if (!text) { return []; }
  return split(text)
    .filter((node) => node.type === SentenceSplitterSyntax.Sentence)
    .map((node) => node.raw.trim())
    .filter((line) => SPEAKABLE.test(line));
}
