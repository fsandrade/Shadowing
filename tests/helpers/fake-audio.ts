import { Page } from '@playwright/test';

export interface FakeVoice {
  name: string;
  lang: string;
}

export interface FakeAudioOptions {
  voices?: FakeVoice[];
  speakMs?: number;
}

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
      (window as any).__spokenText = [];
      const synth: any = window.speechSynthesis;
      synth.speak = (u: FakeUtterance) => {
        (window as any).__spokenText.push(u.text);
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
