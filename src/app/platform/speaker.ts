import { inject, Injectable } from '@angular/core';
import { safetyTimeoutMs } from '../core/timing';
import {
  SPEECH_SUPPORTED,
  SPEECH_SYNTHESIS,
  UTTERANCE_FACTORY,
} from './speech-synthesis';

export interface SpeakOptions {
  readonly rate: number;
  readonly voice: SpeechSynthesisVoice | null;
}

@Injectable({ providedIn: 'root' })
export class Speaker {
  private readonly synth = inject(SPEECH_SYNTHESIS);
  private readonly makeUtterance = inject(UTTERANCE_FACTORY);
  readonly supported = inject(SPEECH_SUPPORTED);

  voices(): SpeechSynthesisVoice[] {
    return this.synth.getVoices() ?? [];
  }

  onVoicesChanged(fn: () => void): void {
    this.synth.addEventListener('voiceschanged', fn);
  }

  speak(text: string, opts: SpeakOptions): Promise<void> {
    const make = this.makeUtterance;
    if (!make) { return Promise.resolve(); }

    return new Promise<void>((resolve) => {
      let settled = false;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const finish = () => {
        if (settled) { return; }
        settled = true;
        clearTimeout(timer);
        resolve();
      };

      const u = make(text);
      u.lang = 'en-US';
      u.rate = opts.rate;
      if (opts.voice) { u.voice = opts.voice; }
      u.onend = finish;
      u.onerror = finish;
      timer = setTimeout(finish, safetyTimeoutMs(text, opts.rate));

      this.synth.cancel();
      this.synth.speak(u);
    });
  }

  cancel(): void {
    this.synth.cancel();
  }

  keepAlive(): void {
    if (this.synth.speaking && !this.synth.paused) {
      this.synth.resume();
    }
  }
}
