export type Rng = () => number;

export function shuffle<T>(list: readonly T[], rng: Rng = Math.random): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.min(Math.floor(rng() * (i + 1)), i);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
