export type Rng = () => number;

/** Fisher-Yates on a copy. `rng` is injectable so shuffling is testable. */
export function shuffle<T>(list: readonly T[], rng: Rng = Math.random): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    // The clamp guards against an rng that returns exactly 1.0, which would
    // otherwise index past the end of the array.
    const j = Math.min(Math.floor(rng() * (i + 1)), i);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
