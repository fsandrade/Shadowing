import { inject, Injectable, signal } from '@angular/core';
import { soundsComplete, starsFor } from '../core/scoring';
import { listenCeilingMs } from '../core/timing';
import { missedWords, type TypedWord, typedWords, typingStars } from '../core/typing';
import { Clock } from '../platform/clock';
import { MicrophoneService } from '../platform/microphone';
import {
  type RecognitionSession, SpeechRecognizer,
} from '../platform/speech-recognition';
import { BannerStore } from '../state/banner-store';
import { MESSAGES } from '../state/messages';
import { SettingsStore } from '../state/settings-store';

export type LineStatus = 'listening' | 'typing' | 'scored' | 'failed';

export interface LineResult {
  readonly transcript: string;
  readonly stars: number | null;
  readonly status: LineStatus;
  readonly words?: readonly TypedWord[];
  readonly missed?: readonly string[];
}

const DENIAL_CODES = new Set(['not-allowed', 'service-not-allowed']);

const START_GRACE_MS = 6000;
const PAUSE_GRACE_MS = 2500;
const WATCH_MS = 250;
const FORCE_FINISH_MS = 1500;

@Injectable({ providedIn: 'root' })
export class ValidationService {
  private readonly recognizer = inject(SpeechRecognizer);
  private readonly mic = inject(MicrophoneService);
  private readonly banner = inject(BannerStore);
  private readonly settings = inject(SettingsStore);
  private readonly clock = inject(Clock);

  private session: RecognitionSession | null = null;
  private settle: (() => void) | null = null;
  private stopWatch: (() => void) | null = null;
  private stopping = false;
  private baseText = '';
  private heardText = '';
  private heardSpeech = false;
  private lastHeardAt = 0;
  private deniedWarned = false;
  private enabling: Promise<boolean> | null = null;

  readonly results = signal<ReadonlyMap<number, LineResult>>(new Map());
  readonly activeLine = signal<number | null>(null);

  begin(lineIndex: number, baseText: string): Promise<void> | null {
    if (this.settings.typingMode()) { return this.beginTyping(lineIndex, baseText); }
    if (this.mic.denied() || !this.recognizer.supported()) { return null; }

    this.dispose();

    this.activeLine.set(lineIndex);
    this.put(lineIndex, {
      transcript: MESSAGES.listening,
      stars: null,
      status: 'listening',
    });

    const done = new Promise<void>((resolve) => { this.settle = resolve; });
    const startedAt = this.clock.now();
    const ceiling = listenCeilingMs(baseText);

    this.baseText = baseText;
    this.heardText = '';
    this.heardSpeech = false;
    this.lastHeardAt = startedAt;
    this.stopping = false;

    this.session = this.recognizer.recognize({
      lang: 'en-US',
      continuous: true,
      onInterim: (t) => {
        if (!this.settle || !t) { return; }
        this.heardText = t;
        this.heardSpeech = true;
        this.lastHeardAt = this.clock.now();
        this.put(lineIndex, { transcript: t, stars: null, status: 'listening' });
        if (soundsComplete(baseText, t)) { this.requestStop(); }
      },
      onResult: (finalText) => {
        if (!this.settle) { return; }
        this.score(lineIndex, baseText, finalText || this.heardText);
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
        this.clearWatch();
        this.finish();
      },
    });
    this.session.start();

    this.stopWatch = this.clock.every(WATCH_MS, () => {
      if (!this.settle || this.stopping) { return; }
      const idleFor = this.clock.now() - this.lastHeardAt;
      const grace = this.heardSpeech ? PAUSE_GRACE_MS : START_GRACE_MS;
      if (idleFor >= grace || this.clock.now() - startedAt >= ceiling) {
        this.requestStop();
      }
    });

    return done;
  }

  private beginTyping(lineIndex: number, baseText: string): Promise<void> {
    this.dispose();

    this.activeLine.set(lineIndex);
    this.baseText = baseText;
    this.put(lineIndex, {
      transcript: MESSAGES.typePrompt,
      stars: null,
      status: 'typing',
    });

    return new Promise<void>((resolve) => { this.settle = resolve; });
  }

  submitTyped(text: string): void {
    if (!this.settle) { return; }
    const lineIndex = this.activeLine();
    if (lineIndex === null) { return; }

    const stars = typingStars(this.baseText, text);
    this.put(lineIndex, stars === null
      ? { transcript: MESSAGES.nothingTyped, stars: null, status: 'failed' }
      : {
        transcript: text,
        stars,
        status: 'scored',
        words: typedWords(this.baseText, text),
        missed: missedWords(this.baseText, text),
      });
    this.activeLine.set(null);
    this.finish();
  }

  dispose(): void {
    this.clearWatch();
    this.session?.abort();
    this.session = null;

    const active = this.activeLine();
    const pending = active === null ? undefined : this.results().get(active)?.status;
    if (active !== null && (pending === 'listening' || pending === 'typing')) {
      this.put(active, {
        transcript: pending === 'typing' ? MESSAGES.nothingTyped : MESSAGES.noSpeechDetected,
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
    if (this.settings.typingMode()) {
      this.settings.setSttEnabled(true);
      return Promise.resolve(true);
    }
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

  private requestStop(): void {
    if (!this.settle || this.stopping) { return; }
    this.stopping = true;
    this.session?.stop();

    const pending = this.clock.wait(FORCE_FINISH_MS);
    void pending.done.then(() => {
      if (!this.settle) { return; }
      const line = this.activeLine();
      if (line === null) { return; }
      this.score(line, this.baseText, this.heardText);
    });
  }

  private score(lineIndex: number, baseText: string, text: string): void {
    const stars = starsFor(baseText, text);
    this.put(lineIndex, stars === null
      ? { transcript: MESSAGES.noSpeechDetected, stars: null, status: 'failed' }
      : { transcript: text, stars, status: 'scored' });
    this.clearWatch();
    this.finish();
  }

  private clearWatch(): void {
    this.stopWatch?.();
    this.stopWatch = null;
    this.stopping = false;
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
    this.clearWatch();
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
