import { describe, expect, it } from 'vitest';
import { ACTIVITIES, activityById, LADDER } from './activity';

describe('the activity catalogue', () => {
  it('offers the four ladder activities plus My text, in ladder order', () => {
    expect(ACTIVITIES.map((a) => a.id))
      .toEqual(['listening', 'shadowing', 'speaking', 'spelling', 'custom']);
  });

  it('numbers the ladder 1 to 4 and leaves My text off it', () => {
    expect(LADDER.map((a) => a.rung)).toEqual([1, 2, 3, 4]);
    expect(activityById('custom')!.rung).toBe(0);
  });

  it('hides the text for the two activities that train the ear', () => {
    expect(activityById('listening')!.preset.blur).toBe(true);
    expect(activityById('spelling')!.preset.blur).toBe(true);
    expect(activityById('shadowing')!.preset.blur).toBe(false);
    expect(activityById('speaking')!.preset.blur).toBe(false);
  });

  it('scores only the two activities that ask for production', () => {
    expect(activityById('listening')!.preset.checkMode).toBe('nothing');
    expect(activityById('shadowing')!.preset.checkMode).toBe('nothing');
    expect(activityById('speaking')!.preset.checkMode).toBe('speaking');
    expect(activityById('spelling')!.preset.checkMode).toBe('spelling');
  });

  it('starts My text unscored, leaving the choice to the learner', () => {
    expect(activityById('custom')!.preset.checkMode).toBe('nothing');
  });

  it('never repeats until five stars by default — there is nothing to repeat toward when unscored', () => {
    expect(ACTIVITIES.every((a) => a.preset.repeatUntilFive === false)).toBe(true);
  });

  it('flags only speaking as needing a microphone', () => {
    expect(ACTIVITIES.filter((a) => a.needsMicrophone).map((a) => a.id)).toEqual(['speaking']);
  });

  it('describes every activity in the learner\'s terms', () => {
    for (const activity of ACTIVITIES) {
      expect(activity.name.length).toBeGreaterThan(0);
      expect(activity.blurb.length).toBeGreaterThan(0);
    }
  });

  it('returns null for anything that is not an activity', () => {
    expect(activityById(null)).toBeNull();
    expect(activityById(undefined)).toBeNull();
    expect(activityById('listening ')).toBeNull();
    expect(activityById('reading')).toBeNull();
  });
});
