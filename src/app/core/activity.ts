// What the learner practises. An activity is a named preset over settings that
// already exist - it adds no practice logic of its own. The ladder is the
// teaching order: exposure, imitation, spoken production, written production.

export type CheckMode = 'nothing' | 'speaking' | 'spelling';

export type ActivityId = 'listening' | 'shadowing' | 'speaking' | 'spelling' | 'custom';

export interface ActivityPreset {
  readonly checkMode: CheckMode;
  readonly blur: boolean;
  readonly repeatUntilFive: boolean;
}

export interface Activity {
  readonly id: ActivityId;
  readonly name: string;
  readonly blurb: string;
  readonly needsMicrophone: boolean;
  readonly preset: ActivityPreset;
}

export const ACTIVITIES: readonly Activity[] = [
  {
    id: 'listening',
    name: 'Listening',
    blurb: 'Listen without reading. Train your ear on its own.',
    needsMicrophone: false,
    preset: { checkMode: 'nothing', blur: true, repeatUntilFive: false },
  },
  {
    id: 'shadowing',
    name: 'Shadowing',
    blurb: 'Listen and repeat along, with the text in front of you.',
    needsMicrophone: false,
    preset: { checkMode: 'nothing', blur: false, repeatUntilFive: false },
  },
  {
    id: 'speaking',
    name: 'Speaking',
    blurb: 'Say each sentence out loud and have it scored.',
    needsMicrophone: true,
    preset: { checkMode: 'speaking', blur: false, repeatUntilFive: false },
  },
  {
    id: 'spelling',
    name: 'Spelling',
    blurb: 'Listen, then type the sentence from memory.',
    needsMicrophone: false,
    preset: { checkMode: 'spelling', blur: true, repeatUntilFive: false },
  },
  {
    id: 'custom',
    name: 'My text',
    // Said plainly because it is a real limitation, not a footnote: this
    // content lives only in the browser and never reaches the database.
    blurb: 'Practise your own text. Nothing here counts toward your progress.',
    needsMicrophone: false,
    preset: { checkMode: 'nothing', blur: false, repeatUntilFive: false },
  },
];

export function activityById(id: string | null | undefined): Activity | null {
  return ACTIVITIES.find((a) => a.id === id) ?? null;
}
