export function localDay(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function previousLocalDay(date: Date): string {
  return localDay(new Date(date.getFullYear(), date.getMonth(), date.getDate() - 1));
}

export interface Streaks {
  readonly current: number;
  readonly longest: number;
}

export function streaks(days: readonly string[], today = new Date()): Streaks {
  const sorted = [...new Set(days)].sort();
  const runs: Array<{ endedOn: string; length: number }> = [];
  let runStart = 0;
  for (let i = 1; i <= sorted.length; i++) {
    if (i === sorted.length || !isConsecutive(sorted[i - 1], sorted[i])) {
      runs.push({ endedOn: sorted[i - 1], length: i - runStart });
      runStart = i;
    }
  }

  const currentDay = localDay(today);
  const yesterday = previousLocalDay(today);
  const current = runs.length
    ? (runs[runs.length - 1].endedOn === currentDay
      || runs[runs.length - 1].endedOn === yesterday)
      ? runs[runs.length - 1].length
      : 0
    : 0;
  const longest = runs.reduce((m, r) => Math.max(m, r.length), 0);
  return { current, longest };
}

function isConsecutive(a: string, b: string): boolean {
  const da = new Date(a + 'T00:00:00Z');
  const db = new Date(b + 'T00:00:00Z');
  return (db.getTime() - da.getTime()) === 86_400_000;
}
