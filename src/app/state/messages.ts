/**
 * Every banner string, copied verbatim from the pre-migration vanilla app.
 * The mix of English and Portuguese is intentional for now: this migration is
 * parity-only. Normalizing the copy is a separate, single-file change.
 */
export const MESSAGES = {
  noEnglishVoice:
    'Nenhuma voz em ingl&ecirc;s instalada neste navegador. ' +
    'Instale uma voz en-US no Windows para praticar com &aacute;udio.',
  speechUnsupported:
    'Este navegador n&atilde;o suporta s&iacute;ntese de voz. ' +
    'As frases continuam vis&iacute;veis para leitura.',
  deadVoice:
    'A voz selecionada n&atilde;o est&aacute; produzindo &aacute;udio. ' +
    'Escolha outra voz no menu <b>voz</b> &mdash; vozes Natural exigem ' +
    'conex&atilde;o com a internet.',
  micDenied:
    'Microphone access was denied — the validator is off for this session. ' +
    'Allow the microphone and reload to use it.',
  sessionSummary: (minutes: number, spoken: number): string =>
    `Sess&atilde;o conclu&iacute;da: ${minutes} min &middot; ` +
    `${spoken}${spoken === 1 ? ' frase repetida.' : ' frases repetidas.'}`,
  listening: 'Listening…',
  noSpeechDetected: 'No speech detected',
  micDeniedInline: 'Microphone denied',
  couldNotListen: 'Could not listen — validation skipped',
} as const;
