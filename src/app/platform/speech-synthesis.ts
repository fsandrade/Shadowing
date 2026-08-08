import { InjectionToken } from '@angular/core';

/** A no-op stand-in so the app runs where speech synthesis is absent. */
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
  // Resolved at injection time, not import time, so a test harness that patches
  // window.speechSynthesis before navigation still wins.
  factory: () =>
    (typeof window !== 'undefined' && window.speechSynthesis) || NOOP_SYNTH,
});

/** Whether the platform really supports speech, as opposed to the no-op above. */
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
