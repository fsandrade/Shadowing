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


function words(transcript: string): string {
  return transcript
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function fold(segments: string[], transcript: string): void {
  const spoken = words(transcript);
  if (!spoken) { return; }

  const tail = segments.length - 1;
  if (tail >= 0) {
    const held = words(segments[tail]);
    if (held && (spoken === held || spoken.startsWith(`${held} `))) {
      segments[tail] = transcript;
      return;
    }
  }
  if (segments.some((segment) => words(segment) === spoken)) { return; }
  segments.push(transcript);
}

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
    const segments: string[] = [];
    const seenFinals = new Map<number, string>();

    rec.onresult = (event) => {
      let changed = false;
      const live: string[] = [];
      const cursor = event.resultIndex ?? 0;
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0]?.transcript ?? '';
        if (!transcript) { continue; }
        if (result.isFinal) {
          if (seenFinals.get(i) === transcript) { continue; }
          seenFinals.set(i, transcript);
          fold(segments, transcript);
          changed = true;
        } else if (i >= cursor) {
          live.push(transcript);
        }
      }
      if (!changed && !live.length) { return; }
      const view = segments.slice();
      for (const pending of live) { fold(view, pending); }
      opts.onInterim?.(view.join(''));
    };

    rec.onerror = (event) => {
      if (ended) { return; }
      opts.onError?.(event?.error ?? null);
    };

    rec.onend = () => {
      if (ended) { return; }
      ended = true;
      opts.onResult?.(segments.join(''));
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
