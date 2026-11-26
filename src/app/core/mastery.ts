export const MASTERY_STARS = 4;
export const MASTERY_STREAK = 3;

export interface MasteryState {
  readonly streak: number;
  readonly mastered: boolean;
}

export function nextMastery(previous: MasteryState, stars: number | null): MasteryState {
  const streak = stars !== null && stars >= MASTERY_STARS
    ? Math.min(previous.streak + 1, MASTERY_STREAK)
    : 0;
  return {
    streak,
    mastered: previous.mastered || streak >= MASTERY_STREAK,
  };
}
