import { describe, expect, it } from 'vitest';
import { MASTERY_STREAK, nextMastery, type MasteryState } from './mastery';

const fresh: MasteryState = { streak: 0, mastered: false };

function advance(stars: readonly (number | null)[], start: MasteryState = fresh): MasteryState {
  return stars.reduce((state, value) => nextMastery(state, value), start);
}

describe('nextMastery', () => {
  it('masters a sentence after three consecutive good ratings', () => {
    expect(advance([4, 5, 4])).toEqual({ streak: MASTERY_STREAK, mastered: true });
    expect(advance([4])).toEqual({ streak: 1, mastered: false });
  });

  it('resets the streak for every rating below four', () => {
    for (const stars of [0, 1, 2, 3, null]) {
      expect(nextMastery({ streak: 2, mastered: false }, stars))
        .toEqual({ streak: 0, mastered: false });
    }
    expect(advance([4, 4, 3])).toEqual({ streak: 0, mastered: false });
  });

  it('never revokes mastery but restarts the streak after a low rating', () => {
    const mastered = advance([5, 5, 5]);
    const lowered = nextMastery(mastered, 1);
    expect(lowered).toEqual({ streak: 0, mastered: true });
    expect(nextMastery(lowered, 4)).toEqual({ streak: 1, mastered: true });
  });

  it('does not mutate the previous state', () => {
    const previous: MasteryState = { streak: 2, mastered: false };
    nextMastery(previous, 4);
    expect(previous).toEqual({ streak: 2, mastered: false });
  });
});
