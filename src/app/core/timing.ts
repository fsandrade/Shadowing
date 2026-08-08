export function pauseMs(speechMs: number, slack: number): number {
  return Math.max(0, Math.round(speechMs * slack));
}

export function safetyTimeoutMs(text: string, rate: number): number {
  return Math.round((String(text).length / 12 / rate + 5) * 1000);
}

const CHARS_PER_SECOND = 12;
const SLOW_SPEAKER_FACTOR = 3;
const MIN_LISTEN_MS = 10_000;
const MAX_LISTEN_MS = 45_000;

export function listenCeilingMs(text: string): number {
  const expected = (String(text).length / CHARS_PER_SECOND) * 1000;
  return Math.min(
    MAX_LISTEN_MS,
    Math.max(MIN_LISTEN_MS, Math.round(expected * SLOW_SPEAKER_FACTOR)),
  );
}

export function nextIndex(i: number, len: number): number {
  return len > 0 ? (i + 1) % len : 0;
}

export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}
