import { inject, Injectable, signal } from '@angular/core';
import { starsFor } from '../core/scoring';
import { MicrophoneService } from '../platform/microphone';
import {
  type RecognitionSession, SpeechRecognizer,
} from '../platform/speech-recognition';
import { BannerStore } from '../state/banner-store';
import { MESSAGES } from '../state/messages';
import { SettingsStore } from '../state/settings-store';

export type LineStatus = 'listening' | 'scored' | 'failed';

export interface LineResult {
  readonly transcript: string;
  readonly stars: number | null;
  readonly status: LineStatus;
}

const DENIAL_CODES = new Set(['not-allowed', 'service-not-allowed']);

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

  readonly results = signal<ReadonlyMap<number, LineResult>>(new Map());
  readonly activeLine = signal<number | null>(null);

  begin(lineIndex: number, baseText: string): Promise<void> | null {
    if (this.mic.denied() || !this.recognizer.supported()) { return null; }

    this.dispose();

    this.activeLine.set(lineIndex);
    this.put(lineIndex, {
      transcript: MESSAGES.listening,
      stars: null,
      status: 'listening',
    });

    const done = new Promise<void>((resolve) => { this.settle = resolve; });

    this.session = this.recognizer.recognize({
      lang: 'en-US',
      onInterim: (t) => {
        if (!this.settle || !t) { return; }
        this.put(lineIndex, { transcript: t, stars: null, status: 'listening' });
      },
      onResult: (finalText) => {
        if (!this.settle) { return; }
        const stars = starsFor(baseText, finalText || '');
        this.put(lineIndex, stars === null
          ? { transcript: MESSAGES.noSpeechDetected, stars: null, status: 'failed' }
          : { transcript: finalText || '', stars, status: 'scored' });
        this.finish();
      },
      onError: (code) => {
        if (!this.settle || code === 'aborted') { return; }
        if (code && DENIAL_CODES.has(code)) {
          this.onDenied(lineIndex);
          return;
        }
        this.put(lineIndex, {
          transcript: MESSAGES.couldNotListen,
          stars: null,
          status: 'failed',
        });
        this.finish();
      },
    });
    this.session.start();
    return done;
  }

  dispose(): void {
    this.session?.abort();
    this.session = null;

    const active = this.activeLine();
    if (active !== null && this.results().get(active)?.status === 'listening') {
      this.put(active, {
        transcript: MESSAGES.noSpeechDetected,
        stars: null,
        status: 'failed',
      });
    }
    this.activeLine.set(null);
    this.finish();
  }

  reset(): void {
    this.dispose();
    this.results.set(new Map());
  }

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
    this.reset();
  }

  private put(lineIndex: number, result: LineResult): void {
    const next = new Map(this.results());
    next.set(lineIndex, result);
    this.results.set(next);
  }

  private onDenied(lineIndex: number): void {
    this.mic.markDenied();
    this.put(lineIndex, {
      transcript: MESSAGES.micDeniedInline,
      stars: null,
      status: 'failed',
    });
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
