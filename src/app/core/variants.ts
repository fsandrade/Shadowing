const GROUPS: ReadonlyArray<readonly [string, readonly string[]]> = [
  ['okay', ['ok', 'okey', 'okays']],
  ['alright', ['allright']],
  ['gray', ['grey']],
  ['yeah', ['yea', 'ya', 'yep', 'yup']],
  ['till', ['til']],
  ['gonna', ['goingto']],
  ['wanna', ['wantto']],
  ['gotta', ['gotto']],
  ['kinda', ['kindof']],
  ['sorta', ['sortof']],
];

const CANONICAL = new Map<string, string>(
  GROUPS.flatMap(([canonical, variants]) =>
    [[canonical, canonical] as [string, string]]
      .concat(variants.map((v) => [v, canonical] as [string, string])),
  ),
);

export function canonicalWord(word: string): string {
  return CANONICAL.get(word) ?? word;
}
