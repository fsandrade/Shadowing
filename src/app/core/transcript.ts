export interface CaptionSegment {
  readonly start: number;
  readonly text: string;
}

export interface TranscriptLine {
  readonly start: number;
  readonly text: string;
}

const SENTENCE_END = /[.!?…"”]$/;
const GAP_MS = 2500;

export function wordCount(text: string): number {
  return text.match(/[\p{L}\p{N}]+/gu)?.length ?? 0;
}

export function mergeSegmentsToLines(
  segments: readonly CaptionSegment[],
): TranscriptLine[] {
  const lines: TranscriptLine[] = [];
  let buffered: string[] = [];
  let start = -1;
  let lastStart = 0;

  const flush = () => {
    const text = buffered.join(' ').trim().replace(/\s+/g, ' ');
    if (start >= 0 && wordCount(text) > 0) {
      lines.push({ start, text });
    }
    buffered = [];
    start = -1;
  };

  for (const segment of segments) {
    const gap = start >= 0 && segment.start - lastStart > GAP_MS / 1000;
    if (gap) { flush(); }
    if (start < 0) { start = segment.start; }
    buffered.push(segment.text.trim());
    if (SENTENCE_END.test(buffered.join(' '))) {
      flush();
    }
    lastStart = segment.start;
  }
  flush();
  return lines;
}