export interface Pacing {
  readonly rate: number;
  readonly slack: number;
}

const DEFAULT: Pacing = { rate: 1, slack: 1 };

const BY_LEVEL: Readonly<Record<string, Pacing>> = {
  A1: { rate: 0.7, slack: 2.5 },
  A2: { rate: 0.8, slack: 2 },
  B1: { rate: 0.9, slack: 1.5 },
  B2: { rate: 1, slack: 1 },
  C1: { rate: 1, slack: 1 },
  C2: { rate: 1, slack: 1 },
};

export function pacingFor(levelId: string | null): Pacing {
  return (levelId && BY_LEVEL[levelId]) || DEFAULT;
}
