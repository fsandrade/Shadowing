import { computed, inject, Injectable, signal } from '@angular/core';
import { starsFor } from '../core/scoring';
import { MicrophoneService } from '../platform/microphone';
import {
  type RecognitionSession, SpeechRecognizer,
} from '../platform/speech-recognition';
import { BannerStore } from '../state/banner-store';
import { MESSAGES } from '../state/messages';
import { SettingsStore } from '../state/settings-store';

/** Recognition error codes that mean the user refused the microphone. */
const DENIAL_CODES = new Set(['not-allowed', 'service-not-allowed']);

/**
 * Drives one recognition session per gap and exposes its result for the inline
 * box. `begin` returns a promise that PlaybackService races against the gap
 * timer, so a quick repeat moves on without waiting out the full pause.
 */
@Injectable({ providedIn: 'root' })
export class ValidationService {
  private readonly recognizer = inject(SpeechRecognizer);
  private readonly mic = inject(MicrophoneService);
  private readonly banner = inject(BannerStore);
  private readonly settings = inject(SettingsStore);

  private session: RecognitionSession | null = null;
  private settle: (() => void) | null = null;
  private deniedWarned = false;
  private enabling: Promise<boolean> | null = null;

  readonly lineIndex = signal<number | null>(null);
  readonly transcript = signal('');
  readonly stars = signal<number | null>(null);
  readonly active = computed(() => this.lineIndex() !== null);

  /** Returns null when there is nothing to listen with. */
  begin(lineIndex: number, baseText: string): Promise<void> | null {
    if (this.mic.denied() || !this.recognizer.supported()) { return null; }

    this.clear();
    this.lineIndex.set(lineIndex);
    this.transcript.set(MESSAGES.listening);
    this.stars.set(null);

    const done = new Promise<void>((resolve) => { this.settle = resolve; });

    this.session = this.recognizer.recognize({
      lang: 'en-US',
      onInterim: (t) => {
        if (!this.settle || !t) { return; }
        this.transcript.set(t);
      },
      onResult: (finalText) => {
        if (!this.settle) { return; }
        const rating = starsFor(baseText, finalText || '');
        if (rating === null) {
          this.transcript.set(MESSAGES.noSpeechDetected);
        } else {
          this.transcript.set(finalText || '');
          this.stars.set(rating);
        }
        this.finish();
      },
      onError: (code) => {
        // `aborted` is our own cancellation; never surface it.
        if (!this.settle || code === 'aborted') { return; }
        if (code && DENIAL_CODES.has(code)) {
          this.onDenied();
          return;
        }
        this.transcript.set(MESSAGES.couldNotListen);
        this.finish();
      },
    });
    this.session.start();
    return done;
  }

  /** Ends the gap's session; a box still saying "Listening…" means silence. */
  dispose(): void {
    this.session?.abort();
    this.session = null;
    if (this.transcript() === MESSAGES.listening) {
      this.transcript.set(MESSAGES.noSpeechDetected);
    }
    this.finish();
  }

  clear(): void {
    this.dispose();
    this.lineIndex.set(null);
    this.transcript.set('');
    this.stars.set(null);
  }

  /**
   * Asks for the microphone up front, so the first line does not lose its gap
   * to a permission prompt. Concurrent calls share one prompt.
   */
  enable(): Promise<boolean> {
    if (this.enabling) { return this.enabling; }
    this.enabling = this.mic.ensure().then(
      () => {
        this.enabling = null;
        this.settings.setSttEnabled(true);
        return true;
      },
      () => {
        this.enabling = null;
        return false;
      },
    );
    return this.enabling;
  }

  disable(): void {
    this.settings.setSttEnabled(false);
    this.clear();
  }

  private onDenied(): void {
    this.mic.markDenied();
    this.transcript.set(MESSAGES.micDeniedInline);
    if (!this.deniedWarned) {
      this.deniedWarned = true;
      this.banner.show(MESSAGES.micDenied, 'stt-denied');
    }
  }

  private finish(): void {
    const settle = this.settle;
    this.settle = null;
    settle?.();
  }
}
