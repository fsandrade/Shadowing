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
  listening: 'Listening…',
  typePrompt: 'Type the sentence, then press Enter · ↑ to hear it again',
  nothingTyped: 'Nothing typed',
  missedWords: (words: readonly string[]): string => `missed: ${words.join(', ')}`,
  noSpeechDetected: 'No speech detected',
  micDeniedInline: 'Microphone denied',
  couldNotListen: 'Could not listen — validation skipped',
} as const;
