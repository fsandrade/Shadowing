/** The repeat-aloud gap: as long as the sentence took, scaled by the slack slider. */
export function pauseMs(speechMs: number, slack: number): number {
  return Math.max(0, Math.round(speechMs * slack));
}

/**
 * Ceiling on how long we will wait for an utterance to report `end`. Some voices
 * never fire it, so this is what keeps the playback loop from stalling forever.
 */
export function safetyTimeoutMs(text: string, rate: number): number {
  return Math.round((String(text).length / 12 / rate + 5) * 1000);
}

/** Advances with wraparound; 0 for an empty list. */
export function nextIndex(i: number, len: number): number {
  return len > 0 ? (i + 1) % len : 0;
}

/** MM:SS, clamped at zero, minutes not rolled into hours. */
export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}
