import { Page } from '@playwright/test';

export interface FakeVoice {
  name: string;
  lang: string;
}

export interface FakeAudioOptions {
  voices?: FakeVoice[];
  speakMs?: number;
}

/**
 * Installs a deterministic speech-synthesis pretend for the app.
 *
 * Headless Chromium exposes `window.speechSynthesis` but reports no voices,
 * so the app shows its "no English voice" banner and disables the controls.
 * Running before navigation, this gives the app an en-US voice and makes every
 * utterance resolve after `speakMs`, so playback loops run head-over-typing.
 */
export function installFakeAudio(page: Page, opts: FakeAudioOptions = {}) {
  const voices = opts.voices ?? [{ name: 'Fake Test Voice', lang: 'en-US' }];
  const speakMs = opts.speakMs ?? 500;
  void page.addInitScript(
    ({ voices, speakMs }) => {
      class FakeUtterance {
        text: string;
        onend: (() => void) | null = null;
        constructor(text: string) {
          this.text = text;
        }
      }
      (window as any).SpeechSynthesisUtterance = FakeUtterance;
      const synth: any = window.speechSynthesis;
      synth.speak = (u: FakeUtterance) => {
        setTimeout(() => {
          if (u.onend) { u.onend(); }
        }, speakMs);
      };
      synth.cancel = () => {};
      synth.resume = () => {};
      synth.getVoices = () => voices;
      synth.speaking = false;
      synth.paused = false;
    },
    { voices, speakMs },
  );
}