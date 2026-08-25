import { inject, Injectable, InjectionToken } from '@angular/core';

export interface RecognitionOptions {
  readonly lang?: string;
  readonly continuous?: boolean;
  onInterim?(text: string): void;
  onResult?(finalText: string): void;
  onError?(code: string | null): void;
}

export interface RecognitionSession {
  start(): void;
  stop(): void;

  abort(): void;
}

interface RecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: RecognitionResultEvent) => void) | null;
  onerror: ((e: RecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

interface RecognitionAlternative {
  readonly transcript?: string;
}

interface RecognitionResult {
  readonly isFinal: boolean;
  readonly [index: number]: RecognitionAlternative | undefined;
}

interface RecognitionResultEvent {
  readonly resultIndex: number;
  readonly results: ArrayLike<RecognitionResult>;
}

interface RecognitionErrorEvent {
  readonly error?: string;
}

export type SpeechRecognitionCtor = new () => RecognitionLike;

export const SPEECH_RECOGNITION_CTOR =
  new InjectionToken<SpeechRecognitionCtor | null>('SPEECH_RECOGNITION_CTOR', {
    providedIn: 'root',
    factory: () => {
      const w = globalThis as unknown as Record<string, unknown>;
      return (w['SpeechRecognition'] ?? w['webkitSpeechRecognition'] ?? null) as
        SpeechRecognitionCtor | null;
    },
  });

@Injectable({ providedIn: 'root' })
export class SpeechRecognizer {
  private readonly ctor = inject(SPEECH_RECOGNITION_CTOR);

  supported(): boolean {
    return this.ctor !== null;
  }

  recognize(opts: RecognitionOptions): RecognitionSession {
    if (!this.ctor) {
      throw new Error('SpeechRecognition is not available in this browser.');
    }

    const rec = new this.ctor();
    rec.lang = opts.lang ?? 'en-US';
    rec.continuous = opts.continuous ?? false;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    let ended = false;
    let finalText = '';

    rec.onresult = (event) => {
      let live = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0]?.transcript ?? '';
        if (result.isFinal) { finalText += transcript; } else { live += transcript; }
      }
      if (live) { opts.onInterim?.(finalText + live); }
    };

    rec.onerror = (event) => {
      if (ended) { return; }
      opts.onError?.(event?.error ?? null);
    };

    rec.onend = () => {
      if (ended) { return; }
      ended = true;
      opts.onResult?.(finalText);
    };

    return {
      start: () => {
        try {
          rec.start();
        } catch (e) {
          opts.onError?.((e as Error)?.message ?? 'recognition-start-failed');
        }
      },
      stop: () => {
        try { rec.stop(); } catch {  }
      },
      abort: () => {
        if (ended) { return; }
        ended = true;
        try { rec.abort(); } catch {  }
      },
    };
  }
}
