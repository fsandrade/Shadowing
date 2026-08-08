const SAME_SOUND_SPELLINGS: ReadonlyArray<readonly [string, readonly string[]]> = [
  ['okay', ['ok', 'okey']],
  ['alright', ['allright']],
  ['gray', ['grey']],
  ['yeah', ['yea']],
  ['till', ['til']],
];

const CANONICAL = new Map<string, string>(
  SAME_SOUND_SPELLINGS.flatMap(([canonical, spellings]) =>
    [[canonical, canonical] as [string, string]]
      .concat(spellings.map((s) => [s, canonical] as [string, string])),
  ),
);

export function canonicalWord(word: string): string {
  return CANONICAL.get(word) ?? word;
}
