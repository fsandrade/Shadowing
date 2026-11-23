import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HistoryService } from '../data/history-service';
import { ProgressService, SENTENCE_IDS } from '../data/progress-service';
import { MicrophoneService } from '../platform/microphone';
import { RANDOM } from '../platform/rng';
import {
  type RecognitionOptions, type RecognitionSession, SpeechRecognizer,
} from '../platform/speech-recognition';
import { SafeStorage } from '../platform/storage';
import { NO_SHUFFLE, TEST_CATALOG } from '../testing/catalog';
import { ValidationService } from '../validation/validation-service';
import { BannerStore } from './banner-store';
import { CATALOG } from './catalog-token';
import { FlowStore } from './flow-store';
import { MESSAGES } from './messages';
import { PracticeStore } from './practice-store';
import { SettingsStore } from './settings-store';

beforeEach(() => {
  for (const key of Object.keys(localStorage).filter((k) => k.startsWith('shadowing.'))) {
    localStorage.removeItem(key);
  }
});

function setup(opts: { micDenied?: boolean } = {}) {
  const store = new Map<string, unknown>();

  let recognition: RecognitionOptions = {};
  const recognizer = {
    supported: () => true,
    recognize: (o: RecognitionOptions) => {
      recognition = o;
      return { start() {}, stop() {}, abort() {} } as unknown as RecognitionSession;
    },
  } as unknown as SpeechRecognizer;

  
  
  
  let seed = NO_SHUFFLE();

  let denied = opts.micDenied ?? false;
  const mic = {
    denied: () => denied,
    ensure: () => (denied
      ? Promise.reject(new Error('microphone-denied'))
      : Promise.resolve({})),
    markDenied: () => {},
    release: () => {},
  } as unknown as MicrophoneService;

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: CATALOG, useValue: TEST_CATALOG },
      { provide: RANDOM, useValue: () => seed },
      { provide: SENTENCE_IDS, useValue: new Map<string, string>() },
      { provide: SpeechRecognizer, useValue: recognizer },
      { provide: MicrophoneService, useValue: mic },
      {
        provide: SafeStorage,
        useValue: {
          read: (key: string) => store.get(key) ?? null,
          write: (key: string, value: unknown) => { store.set(key, value); },
        } as unknown as SafeStorage,
      },
    ],
  });

  return {
    flow: TestBed.inject(FlowStore),
    settings: TestBed.inject(SettingsStore),
    progress: TestBed.inject(ProgressService),
    banner: TestBed.inject(BannerStore),
    validation: TestBed.inject(ValidationService),
    practice: TestBed.inject(PracticeStore),
    history: TestBed.inject(HistoryService),
    heard: (text: string) => recognition.onResult?.(text),
    setMicDenied: (value: boolean) => { denied = value; },
    setSeed: (value: number) => { seed = value; },
  };
}

describe('FlowStore screens', () => {
  it('opens on the chooser with no session running', () => {
    const { flow } = setup();
    expect(flow.screen()).toBe('chooser');
  });

  it('goes to practice on start, to the summary on finish, and back to the chooser', async () => {
    const { flow } = setup();

    await flow.start('speaking', 'catalog', 'a', 10);
    expect(flow.screen()).toBe('practice');

    flow.finish();
    expect(flow.screen()).toBe('summary');

    flow.backToChooser();
    expect(flow.screen()).toBe('chooser');
  });

  it('ignores a finish with no session running', () => {
    const { flow } = setup();
    flow.finish();
    expect(flow.screen()).toBe('chooser');
    expect(flow.result()).toBeNull();
  });

  it('a dictation session lands on the dictation screen', async () => {
    const { flow } = setup();
    await flow.start('dictation', 'catalog', null, 5);
    expect(flow.screen()).toBe('dictation');
    expect(flow.kind()).toBe('dictation');
  });
});

describe('FlowStore starting a session', () => {
  it('applies the validation the kind needs', async () => {
    const { flow, settings } = setup();

    await flow.start('speaking', 'catalog', 'a', 10);
    expect(settings.sttEnabled()).toBe(true);
    expect(settings.typingMode()).toBe(false);

    await flow.start('dictation', 'catalog', 'a', 10);
    expect(settings.typingMode()).toBe(true);
  });

  it('sets the chosen topic and duration', async () => {
    const { flow, settings } = setup();
    await flow.start('speaking', 'catalog', 'a', 15);
    expect(settings.topicId()).toBe('a');
    expect(settings.durationMin()).toBe(15);
    expect(settings.source()).toBe('catalog');
  });

  it('takes null to mean every topic', async () => {
    const { flow, settings } = setup();
    await flow.start('speaking', 'catalog', null, 10);
    expect(settings.topicId()).toBeNull();
  });

  it('reshuffles the study queue on every start', async () => {
    const { flow, practice, setSeed } = setup();

    await flow.start('speaking', 'catalog', 'a', 10);
    expect(practice.lines()).toEqual(['a1', 'a2', 'a3']);

    setSeed(0);
    flow.finish();
    await flow.start('speaking', 'catalog', 'a', 10);

    expect(practice.lines()).not.toEqual(['a1', 'a2', 'a3']);
  });

  it('leaves a mastered sentence out of the next session queue', async () => {
    const { flow, practice, history } = setup();

    await flow.start('speaking', 'catalog', 'a', 10);
    expect(practice.lines()).toEqual(['a1', 'a2', 'a3']);

    localStorage.setItem('shadowing.attempts', JSON.stringify([
      {
        sentenceId: 's-a1',
        status: 'scored',
        stars: 5,
        attemptedAt: new Date().toISOString(),
      },
    ]));
    history.refresh();

    flow.finish();
    await flow.start('speaking', 'catalog', 'a', 10);

    expect(practice.lines()).toEqual(['a2', 'a3']);
  });

  it('switches to the learner\'s own text for My text', async () => {
    const { flow, settings } = setup();
    await flow.start('dictation', 'custom', null, 10);
    expect(settings.source()).toBe('custom');
    expect(settings.typingMode()).toBe(true);
  });

  it('remembers which kind is running', async () => {
    const { flow } = setup();
    await flow.start('speaking', 'catalog', 'a', 10);
    expect(flow.kind()).toBe('speaking');
  });

  it('opens a progress session for a catalog kind with the chosen topic and minutes', async () => {
    const { flow, progress } = setup();
    const startSession = vi.spyOn(progress, 'startSession');

    await flow.start('speaking', 'catalog', 'a', 15);

    expect(startSession).toHaveBeenCalledOnce();
    expect(startSession).toHaveBeenCalledWith('speaking', 'a', 15);
  });

  it('starts the scored screen empty when the same kind restarts on the same topic', async () => {
    const { flow, validation, heard } = setup();

    await flow.start('speaking', 'catalog', 'a', 10);
    void validation.begin(0, 'a1');
    heard('a1');
    await Promise.resolve();
    expect(validation.results().size).toBe(1);

    flow.finish();
    
    
    await flow.start('speaking', 'catalog', 'a', 10);

    expect(validation.results().size).toBe(0);
    expect(validation.activeLine()).toBeNull();
  });

  it('says so when Speaking degrades to unscored because the mic was refused', async () => {
    const { flow, settings, banner } = setup({ micDenied: true });

    await flow.start('speaking', 'catalog', 'a', 10);

    
    
    expect(settings.sttEnabled()).toBe(false);
    expect(banner.html()).toBe(MESSAGES.micDenied);
  });

  it('raises no warning when the session got the validation it asked for', async () => {
    const { flow, banner } = setup();

    await flow.start('speaking', 'catalog', 'a', 10);
    expect(banner.html()).toBeNull();

    await flow.start('dictation', 'catalog', 'a', 10);
    expect(banner.html()).toBeNull();
  });

  it('retracts the denied-mic warning once a session that needs no microphone starts', async () => {
    const { flow, banner } = setup({ micDenied: true });

    await flow.start('speaking', 'catalog', 'a', 10);
    expect(banner.html()).toBe(MESSAGES.micDenied);

    
    
    await flow.start('dictation', 'catalog', 'a', 10);
    expect(banner.html()).toBeNull();
  });

  it('retracts the denied-mic warning once the microphone is granted and Speaking restarts', async () => {
    const { flow, banner, setMicDenied } = setup({ micDenied: true });

    await flow.start('speaking', 'catalog', 'a', 10);
    expect(banner.html()).toBe(MESSAGES.micDenied);

    setMicDenied(false);
    await flow.start('speaking', 'catalog', 'a', 10);
    expect(banner.html()).toBeNull();
  });

  it('never opens a database session for My text', async () => {
    const { flow, progress } = setup();
    const startSession = vi.spyOn(progress, 'startSession');

    await flow.start('dictation', 'custom', null, 10);

    expect(startSession).not.toHaveBeenCalled();
  });

  it('custom sources never open a database session', async () => {
    const { flow, progress } = setup();
    const startSession = vi.spyOn(progress, 'startSession');

    
    await flow.start('dictation', 'custom', null, 15);
    await flow.start('speaking', 'custom', null, 15);

    expect(startSession).not.toHaveBeenCalled();
    expect(flow.kind()).toBe('speaking'); 
    expect(flow.screen()).toBe('practice');
  });
});

describe('FlowStore finishing', () => {
  it('reports what the session was and what came of it', async () => {
    const { flow } = setup();
    await flow.start('speaking', 'catalog', 'a', 15);

    flow.finish();

    const result = flow.result()!;
    expect(result.kind).toBe('speaking');
    expect(result.source).toBe('catalog');
    expect(result.name).toBe('Speaking');
    expect(result.topicId).toBe('a');
    
    
    expect(result.practisedMs).toBe(0);
    expect(result.spoken).toBe(0);
    expect(result.stars).toBeNull();
  });

  it('names a My text session by its source, not a kind', async () => {
    const { flow } = setup();
    await flow.start('dictation', 'custom', null, 10);

    flow.finish();

    const result = flow.result()!;
    expect(result.kind).toBe('dictation');
    expect(result.source).toBe('custom');
    expect(result.name).toBe('My text');
  });

  it('closes the progress session it opened', async () => {
    const { flow, progress } = setup();
    await flow.start('speaking', 'catalog', 'a', 15);
    const endSession = vi.spyOn(progress, 'endSession');

    flow.finish();

    expect(endSession).toHaveBeenCalledOnce();
  });

  it('clears the last result when the next session starts', async () => {
    const { flow } = setup();
    await flow.start('speaking', 'catalog', 'a', 15);
    flow.finish();
    expect(flow.result()).not.toBeNull();

    await flow.start('dictation', 'catalog', 'a', 5);
    expect(flow.result()).toBeNull();
    expect(flow.screen()).toBe('dictation');
  });
});

