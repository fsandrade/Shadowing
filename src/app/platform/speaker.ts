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

/** Speaks one sentence at a time and always settles, even for a mute voice. */
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

  /**
   * Resolves on `end`, on `error`, or after `safetyTimeoutMs` — whichever comes
   * first, exactly once. Some voices never fire `end`; without the timeout the
   * playback loop would stall forever.
   */
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

  /** Chrome silently pauses long-lived synthesis; this pokes it awake. */
  keepAlive(): void {
    if (this.synth.speaking && !this.synth.paused) {
      this.synth.resume();
    }
  }
}
