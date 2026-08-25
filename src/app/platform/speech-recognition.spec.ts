import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  SPEECH_RECOGNITION_CTOR,
  type SpeechRecognitionCtor,
  SpeechRecognizer,
} from './speech-recognition';

class FakeRecognition {
  static last: FakeRecognition | null = null;
  lang = '';
  continuous: boolean | undefined;
  interimResults: boolean | undefined;
  maxAlternatives: number | undefined;
  onresult: ((e: unknown) => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;
  onend: (() => void) | null = null;
  started = false;
  stopped = false;
  aborted = false;
  constructor() { FakeRecognition.last = this; }
  start() { this.started = true; }
  stop() { this.stopped = true; }
  abort() { this.aborted = true; }
}

function fireResult(rec: FakeRecognition, transcript: string, isFinal: boolean) {
  rec.onresult?.({
    resultIndex: 0,
    results: [{ 0: { transcript }, isFinal, length: 1 }],
  });
}

function fireEvent(rec: FakeRecognition, resultIndex: number, results: Array<{ transcript: string; isFinal: boolean }>) {
  rec.onresult?.({
    resultIndex,
    results: results.map((r) => ({ 0: { transcript: r.transcript }, isFinal: r.isFinal, length: 1 })),
  });
}

function recognizer(ctor: SpeechRecognitionCtor | null) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [{ provide: SPEECH_RECOGNITION_CTOR, useValue: ctor }],
  });
  return TestBed.inject(SpeechRecognizer);
}

const Ctor = FakeRecognition as unknown as SpeechRecognitionCtor;

describe('SpeechRecognizer', () => {
  beforeEach(() => { FakeRecognition.last = null; });

  it('supported() is false when no recognition API exists', () => {
    expect(recognizer(null).supported()).toBe(false);
  });

  it('supported() is true when a recognition API exists', () => {
    expect(recognizer(Ctor).supported()).toBe(true);
  });

  it('recognize throws when no recognition API exists', () => {
    expect(() => recognizer(null).recognize({})).toThrow(/not available/i);
  });

  it('starts a one-shot interim session and reports onInterim', () => {
    const interim: string[] = [];
    const session = recognizer(Ctor).recognize({
      lang: 'pt-BR',
      onInterim: (t) => interim.push(t),
    });
    session.start();

    const rec = FakeRecognition.last!;
    expect(rec.started).toBe(true);
    expect(rec.lang).toBe('pt-BR');
    expect(rec.continuous).toBe(false);
    expect(rec.interimResults).toBe(true);
    expect(rec.maxAlternatives).toBe(1);

    fireResult(rec, 'hello ', false);
    expect(interim).toEqual(['hello ']);
  });

  it('defaults the language to en-US', () => {
    recognizer(Ctor).recognize({}).start();
    expect(FakeRecognition.last!.lang).toBe('en-US');
  });

  it('can run continuously so the browser stops ending on the first pause', () => {
    recognizer(Ctor).recognize({ continuous: true }).start();
    expect(FakeRecognition.last!.continuous).toBe(true);
  });

  it('calls onResult once with the accumulated final text when recognition ends', () => {
    const results: string[] = [];
    recognizer(Ctor).recognize({ onResult: (t) => results.push(t) }).start();
    const rec = FakeRecognition.last!;

    fireEvent(rec, 0, [{ transcript: 'hit the ', isFinal: true }]);
    fireEvent(rec, 1, [{ transcript: 'hit the ', isFinal: true }, { transcript: 'road', isFinal: true }]);
    rec.onend?.();
    rec.onend?.();

    expect(results).toEqual(['hit the road']);
  });

  it('onResult receives an empty string when nothing was said', () => {
    const results: string[] = [];
    recognizer(Ctor).recognize({ onResult: (t) => results.push(t) }).start();
    FakeRecognition.last!.onend?.();
    expect(results).toEqual(['']);
  });

  it('collapses cumulative final snapshots into what was said once', () => {
    const finals: string[] = [];
    recognizer(Ctor).recognize({ continuous: true, onResult: (t) => finals.push(t) }).start();
    const rec = FakeRecognition.last!;

    fireEvent(rec, 0, [{ transcript: 'can', isFinal: true }]);
    fireEvent(rec, 1, [
      { transcript: 'can', isFinal: true },
      { transcript: 'can I', isFinal: true },
    ]);
    fireEvent(rec, 2, [
      { transcript: 'can', isFinal: true },
      { transcript: 'can I get', isFinal: true },
    ]);
    fireEvent(rec, 3, [
      { transcript: 'can', isFinal: true },
      { transcript: 'can I get a large fries to go', isFinal: true },
    ]);
    rec.onend?.();

    expect(finals).toEqual(['can I get a large fries to go']);
  });

  it('counts each finalized index once when the browser resends history every event', () => {
    const finals: string[] = [];
    recognizer(Ctor).recognize({ continuous: true, onResult: (t) => finals.push(t) }).start();
    const rec = FakeRecognition.last!;

    fireEvent(rec, 0, [{ transcript: 'hit the ', isFinal: true }]);
    fireEvent(rec, 1, [
      { transcript: 'hit the ', isFinal: true },
      { transcript: 'road', isFinal: true },
    ]);
    fireEvent(rec, 1, [
      { transcript: 'hit the ', isFinal: true },
      { transcript: 'road', isFinal: true },
    ]);
    rec.onend?.();

    expect(finals).toEqual(['hit the road']);
  });

  it('keeps separate utterances that do not build on each other', () => {
    const finals: string[] = [];
    recognizer(Ctor).recognize({ continuous: true, onResult: (t) => finals.push(t) }).start();
    const rec = FakeRecognition.last!;

    fireEvent(rec, 0, [{ transcript: 'hit the ', isFinal: true }]);
    fireEvent(rec, 1, [{ transcript: 'road', isFinal: true }]);
    rec.onend?.();

    expect(finals).toEqual(['hit the road']);
  });

  it('interim text never echoes the growing snapshot chain', () => {
    const interims: string[] = [];
    recognizer(Ctor).recognize({ continuous: true, onInterim: (t) => interims.push(t) }).start();
    const rec = FakeRecognition.last!;

    fireEvent(rec, 0, [{ transcript: 'can', isFinal: true }]);
    fireEvent(rec, 1, [
      { transcript: 'can', isFinal: true },
      { transcript: 'can I', isFinal: false },
    ]);
    fireEvent(rec, 1, [
      { transcript: 'can', isFinal: true },
      { transcript: 'can I get a', isFinal: false },
    ]);
    fireEvent(rec, 2, [
      { transcript: 'can', isFinal: true },
      { transcript: 'can I get a large fries to go', isFinal: true },
    ]);
    rec.onend?.();

    expect(interims).toEqual([
      'can',
      'can I',
      'can I get a',
      'can I get a large fries to go',
    ]);
  });

  it('onError forwards the API error code', () => {
    const codes: Array<string | null> = [];
    recognizer(Ctor).recognize({ onError: (c) => codes.push(c) }).start();
    FakeRecognition.last!.onerror?.({ error: 'not-allowed' });
    expect(codes).toEqual(['not-allowed']);
  });

  it('abort suppresses onend, onresult and onerror', () => {
    const seen: string[] = [];
    const session = recognizer(Ctor).recognize({
      onResult: () => seen.push('result'),
      onError: () => seen.push('error'),
    });
    session.start();
    session.abort();

    const rec = FakeRecognition.last!;
    expect(rec.aborted).toBe(true);
    rec.onend?.();
    rec.onerror?.({ error: 'aborted' });
    expect(seen).toEqual([]);
  });

  it('stop is graceful and does not abort', () => {
    const session = recognizer(Ctor).recognize({});
    session.start();
    session.stop();
    expect(FakeRecognition.last!.stopped).toBe(true);
    expect(FakeRecognition.last!.aborted).toBe(false);
  });

  it('reports a start failure through onError instead of throwing', () => {
    class Exploding extends FakeRecognition {
      override start(): never { throw new Error('already started'); }
    }
    const codes: Array<string | null> = [];
    const session = recognizer(Exploding as unknown as SpeechRecognitionCtor)
      .recognize({ onError: (c) => codes.push(c) });
    expect(() => session.start()).not.toThrow();
    expect(codes).toEqual(['already started']);
  });
});
