import { InjectionToken } from '@angular/core';

const NOOP_SYNTH = {
  getVoices: () => [],
  speak: () => {},
  cancel: () => {},
  pause: () => {},
  resume: () => {},
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => false,
  speaking: false,
  paused: false,
  pending: false,
  onvoiceschanged: null,
} as unknown as SpeechSynthesis;

export const SPEECH_SYNTHESIS = new InjectionToken<SpeechSynthesis>('SPEECH_SYNTHESIS', {
  providedIn: 'root',

  factory: () =>
    (typeof window !== 'undefined' && window.speechSynthesis) || NOOP_SYNTH,
});

export const SPEECH_SUPPORTED = new InjectionToken<boolean>('SPEECH_SUPPORTED', {
  providedIn: 'root',
  factory: () => typeof window !== 'undefined' && 'speechSynthesis' in window,
});

export type UtteranceFactory = ((text: string) => SpeechSynthesisUtterance) | null;

export const UTTERANCE_FACTORY = new InjectionToken<UtteranceFactory>('UTTERANCE_FACTORY', {
  providedIn: 'root',
  factory: (): UtteranceFactory => {
    if (typeof window === 'undefined' || !window.SpeechSynthesisUtterance) { return null; }
    return (text: string) => new window.SpeechSynthesisUtterance(text);
  },
});
