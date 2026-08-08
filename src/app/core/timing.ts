export function pauseMs(speechMs: number, slack: number): number {
  return Math.max(0, Math.round(speechMs * slack));
}

export function safetyTimeoutMs(text: string, rate: number): number {
  return Math.round((String(text).length / 12 / rate + 5) * 1000);
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
