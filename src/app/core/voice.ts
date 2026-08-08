export interface VoiceLike {
  readonly name: string;
  readonly lang: string;
}

export function isEnglish(v: VoiceLike): boolean {
  return /^en/i.test(v.lang ?? '');
}

export function pickVoice<T extends VoiceLike>(
  voices: readonly T[],
  preferredName = '',
): T | null {
  if (!voices.length) { return null; }

  const byName = preferredName
    ? voices.find((v) => v.name === preferredName)
    : undefined;
  if (byName) { return byName; }

  const naturalUs = voices.find(
    (v) => /^en-US$/i.test(v.lang ?? '') && /natural/i.test(v.name ?? ''),
  );
  if (naturalUs) { return naturalUs; }

  const us = voices.find((v) => /^en-US$/i.test(v.lang ?? ''));
  if (us) { return us; }

  return voices.find(isEnglish) ?? voices[0];
}

export function hasEnglishVoice(voices: readonly VoiceLike[]): boolean {
  return voices.some(isEnglish);
}
