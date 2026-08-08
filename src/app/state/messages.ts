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
  sessionSummary: (minutes: number, spoken: number): string =>
    `Session complete: ${minutes} min · ` +
    `${spoken}${spoken === 1 ? ' sentence repeated.' : ' sentences repeated.'}`,
  listening: 'Listening…',
  noSpeechDetected: 'No speech detected',
  micDeniedInline: 'Microphone denied',
  couldNotListen: 'Could not listen — validation skipped',
} as const;
