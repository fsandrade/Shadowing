export interface CaptionSegment {
  readonly start: number;
  readonly text: string;
}

interface Json3Event {
  tStartMs?: number;
  segs?: Array<{ utf8?: string }>;
}

export function parseJson3Captions(json: unknown): CaptionSegment[] {
  if (!json || typeof json !== 'object') { return []; }
  const events = (json as { events?: Json3Event[] }).events;
  if (!Array.isArray(events)) { return []; }

  const out: CaptionSegment[] = [];
  for (const event of events) {
    if (typeof event.tStartMs !== 'number') { continue; }
    const text = (event.segs ?? [])
      .map((seg) => seg.utf8 ?? '')
      .join('')
      .trim();
    if (!text) { continue; }
    out.push({ start: event.tStartMs / 1000, text });
  }
  return out;
}
