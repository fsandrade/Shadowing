export type PracticeKind = 'speaking' | 'dictation';

export interface Kind {
  readonly id: PracticeKind;
  readonly name: string;
  readonly blurb: string;
  readonly needsMicrophone: boolean;
}

export const KINDS: readonly Kind[] = [
  {
    id: 'speaking',
    name: 'Speaking',
    blurb: 'Say each sentence out loud and have it scored.',
    needsMicrophone: true,
  },
  {
    id: 'dictation',
    name: 'Dictation',
    blurb: 'Listen, type what you hear, and check it word by word.',
    needsMicrophone: false,
  },
];

export function kindById(id: string | null | undefined): Kind | null {
  return KINDS.find((k) => k.id === id) ?? null;
}
