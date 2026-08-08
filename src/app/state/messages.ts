export const MESSAGES = {
  noEnglishVoice:
    'No English voice is installed in this browser. ' +
    'Install an en-US voice in Windows to practice with audio.',
  speechUnsupported:
    'This browser does not support speech synthesis. ' +
    'The sentences are still visible to read.',
  deadVoice:
    'The selected voice is not producing any audio. ' +
    'Pick another voice from the <b>voice</b> menu — Natural voices need ' +
    'an internet connection.',
  micDenied:
    'Microphone access was denied — the validator is off for this session. ' +
    'Allow the microphone and reload to use it.',
  sessionSummary: (minutes: number, spoken: number, stars: number | null): string => {
    const sentences = `${spoken}${spoken === 1 ? ' sentence' : ' sentences'} repeated`;
    const won = stars === null
      ? ''
      : ` · ${stars}${stars === 1 ? ' star' : ' stars'} won`;
    return `Session complete: ${minutes} min · ${sentences}${won}.`;
  },
  listening: 'Listening…',
  noSpeechDetected: 'No speech detected',
  micDeniedInline: 'Microphone denied',
  couldNotListen: 'Could not listen — validation skipped',
} as const;
