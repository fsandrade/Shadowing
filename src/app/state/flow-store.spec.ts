import { TestBed } from '@angular/core/testing';
import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { activityById } from '../core/activity';
import { ProgressService, SENTENCE_IDS } from '../data/progress-service';
import { INITIAL_USER } from '../platform/auth';
import { MicrophoneService } from '../platform/microphone';
import { RANDOM } from '../platform/rng';
import {
  type RecognitionOptions, type RecognitionSession, SpeechRecognizer,
} from '../platform/speech-recognition';
import { SafeStorage } from '../platform/storage';
import { SUPABASE } from '../platform/supabase-client';
import { NO_SHUFFLE, TEST_CATALOG, TEST_LEVEL } from '../testing/catalog';
import { ValidationService } from '../validation/validation-service';
import { BannerStore } from './banner-store';
import { CATALOG } from './catalog-token';
import { FlowStore } from './flow-store';
import { MESSAGES } from './messages';
import { PracticeStore } from './practice-store';
import { ProfileStore } from './profile-store';
import { SettingsStore } from './settings-store';

function fakeSupabase() {
  return {
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }) }),
      upsert: () => Promise.resolve({ error: null }),
      insert: () => Promise.resolve({ error: null, status: 201 }),
      update: () => ({ eq: () => Promise.resolve({ error: null, status: 204 }) }),
    }),
    auth: { onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) },
  } as unknown as SupabaseClient;
}

function setup(opts: { level?: string | null; micDenied?: boolean } = {}) {
  const level = opts.level === undefined ? TEST_LEVEL : opts.level;
  const store = new Map<string, unknown>([
    ['shadowing.profile', level === null ? { levelId: null } : { levelId: level }],
  ]);

  let recognition: RecognitionOptions = {};
  const recognizer = {
    supported: () => true,
    recognize: (o: RecognitionOptions) => {
      recognition = o;
      return { start() {}, stop() {}, abort() {} } as unknown as RecognitionSession;
    },
  } as unknown as SpeechRecognizer;

  // NO_SHUFFLE's value: every draw lands on the element already there, so the
  // order comes out unchanged. Moving it makes the shuffle produce a different
  // permutation, which is how a test tells one shuffle from another.
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
      { provide: SUPABASE, useValue: fakeSupabase() },
      { provide: INITIAL_USER, useValue: null },
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
    profile: TestBed.inject(ProfileStore),
    progress: TestBed.inject(ProgressService),
    banner: TestBed.inject(BannerStore),
    validation: TestBed.inject(ValidationService),
    practice: TestBed.inject(PracticeStore),
    heard: (text: string) => recognition.onResult?.(text),
    setMicDenied: (value: boolean) => { denied = value; },
    setSeed: (value: number) => { seed = value; },
  };
}

describe('FlowStore screens', () => {
  it('asks for a level on a first visit and nothing else', () => {
    const { flow } = setup({ level: null });
    expect(flow.screen()).toBe('onboarding');
  });

  it('opens on the chooser once a level is known', () => {
    const { flow } = setup();
    expect(flow.screen()).toBe('chooser');
  });

  it('leaves onboarding the moment a level is chosen', () => {
    const { flow, profile } = setup({ level: null });
    profile.setLevel('A2');
    expect(flow.screen()).toBe('chooser');
  });

  it('goes to practice on start, to the summary on finish, and back to the chooser', async () => {
    const { flow } = setup();

    await flow.start(activityById('listening')!, 'a', 10);
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
});

describe('FlowStore starting an activity', () => {
  it('applies the activity preset', async () => {
    const { flow, settings } = setup();

    await flow.start(activityById('listening')!, 'a', 10);
    expect(settings.blur()).toBe(true);
    expect(settings.sttEnabled()).toBe(false);

    await flow.start(activityById('spelling')!, 'a', 10);
    expect(settings.blur()).toBe(true);
    expect(settings.sttEnabled()).toBe(true);
    expect(settings.typingMode()).toBe(true);
  });

  it('applies the pacing the level suggests', async () => {
    const { flow, settings } = setup();
    await flow.start(activityById('listening')!, 'a', 10);
    expect(settings.rate()).toBe(0.8);
    expect(settings.slack()).toBe(2);
  });

  it('sets the chosen topic and duration', async () => {
    const { flow, settings } = setup();
    await flow.start(activityById('shadowing')!, 'a', 15);
    expect(settings.topicId()).toBe('a');
    expect(settings.durationMin()).toBe(15);
    expect(settings.source()).toBe('catalog');
  });

  it('takes null to mean every topic at the level', async () => {
    const { flow, settings } = setup();
    await flow.start(activityById('shadowing')!, null, 10);
    expect(settings.topicId()).toBeNull();
  });

  it('switches to the learner\'s own text for My text, and honours the check mode they picked', async () => {
    const { flow, settings } = setup();
    await flow.start(activityById('custom')!, null, 10, 'spelling');
    expect(settings.source()).toBe('custom');
    expect(settings.typingMode()).toBe(true);
    expect(settings.sttEnabled()).toBe(true);
  });

  it('remembers which activity is running', async () => {
    const { flow } = setup();
    await flow.start(activityById('speaking')!, 'a', 10);
    expect(flow.activity()?.id).toBe('speaking');
  });

  it('opens a progress session for a ladder activity with the chosen topic and minutes', async () => {
    const { flow, progress } = setup();
    const startSession = vi.spyOn(progress, 'startSession');

    await flow.start(activityById('shadowing')!, 'a', 15);

    expect(startSession).toHaveBeenCalledOnce();
    expect(startSession).toHaveBeenCalledWith('shadowing', 'a', 15);
  });

  it('starts the scored screen empty when the same activity restarts on the same topic', async () => {
    const { flow, validation, heard } = setup();

    await flow.start(activityById('speaking')!, 'a', 10);
    void validation.begin(0, 'a1');
    heard('a1');
    await Promise.resolve();
    expect(validation.results().size).toBe(1);

    flow.finish();
    // Same activity, same topic: no signal the validator watches changes, so
    // nothing else clears the last session's transcripts and stars.
    await flow.start(activityById('speaking')!, 'a', 10);

    expect(validation.results().size).toBe(0);
    expect(validation.activeLine()).toBeNull();
  });

  it('says so when Speaking degrades to unscored because the mic was refused', async () => {
    const { flow, settings, banner } = setup({ micDenied: true });

    await flow.start(activityById('speaking')!, 'a', 10);

    // Silently, this is Shadowing under another name - and the session row
    // still says activity = 'speaking'.
    expect(settings.sttEnabled()).toBe(false);
    expect(banner.html()).toBe(MESSAGES.micDenied);
  });

  it('raises no warning when the activity got the mode it asked for', async () => {
    const { flow, banner } = setup();

    await flow.start(activityById('speaking')!, 'a', 10);
    expect(banner.html()).toBeNull();

    await flow.start(activityById('listening')!, 'a', 10);
    expect(banner.html()).toBeNull();
  });

  it('retracts the denied-mic warning once an activity that needs no microphone starts', async () => {
    const { flow, banner } = setup({ micDenied: true });

    await flow.start(activityById('speaking')!, 'a', 10);
    expect(banner.html()).toBe(MESSAGES.micDenied);

    // Listening asks for 'nothing', which a denied mic can always deliver -
    // the warning is about a session that never happened, and must not
    // survive on screen for it.
    await flow.start(activityById('listening')!, 'a', 10);
    expect(banner.html()).toBeNull();
  });

  it('retracts the denied-mic warning once the microphone is granted and Speaking restarts', async () => {
    const { flow, banner, setMicDenied } = setup({ micDenied: true });

    await flow.start(activityById('speaking')!, 'a', 10);
    expect(banner.html()).toBe(MESSAGES.micDenied);

    setMicDenied(false);
    await flow.start(activityById('speaking')!, 'a', 10);
    expect(banner.html()).toBeNull();
  });

  it('never opens a database session for My text', async () => {
    const { flow, progress } = setup();
    const startSession = vi.spyOn(progress, 'startSession');

    await flow.start(activityById('custom')!, null, 10);

    expect(startSession).not.toHaveBeenCalled();
  });
});

describe('FlowStore finishing', () => {
  it('reports what the session was and what came of it', async () => {
    const { flow } = setup();
    await flow.start(activityById('shadowing')!, 'a', 15);

    flow.finish();

    const result = flow.result()!;
    expect(result.activity.id).toBe('shadowing');
    expect(result.topicId).toBe('a');
    // Nothing was ever played, so nothing was practised - the summary reports
    // the time consumed, not the 15 minutes that were planned.
    expect(result.practisedMs).toBe(0);
    expect(result.spoken).toBe(0);
    expect(result.stars).toBeNull();
  });

  it('closes the progress session it opened', async () => {
    const { flow, progress } = setup();
    await flow.start(activityById('shadowing')!, 'a', 15);
    const endSession = vi.spyOn(progress, 'endSession');

    flow.finish();

    expect(endSession).toHaveBeenCalledOnce();
  });

  it('clears the last result when the next activity starts', async () => {
    const { flow } = setup();
    await flow.start(activityById('shadowing')!, 'a', 15);
    flow.finish();
    expect(flow.result()).not.toBeNull();

    await flow.start(activityById('listening')!, 'a', 5);
    expect(flow.result()).toBeNull();
    expect(flow.screen()).toBe('practice');
  });
});

describe('FlowStore reshuffles on every start', () => {
  it('reorders the sentences when the same activity restarts on the same topic', async () => {
    const { flow, practice, setSeed } = setup();

    await flow.start(activityById('shadowing')!, 'a', 10);
    const first = [...practice.lines()];
    expect(first.length).toBeGreaterThan(1);

    flow.finish();
    setSeed(0);
    await flow.start(activityById('shadowing')!, 'a', 10);

    expect(practice.lines()).not.toEqual(first);
  });

  it('keeps the same sentences, only in a different order', async () => {
    const { flow, practice, setSeed } = setup();

    await flow.start(activityById('shadowing')!, 'a', 10);
    const first = [...practice.lines()];

    flow.finish();
    setSeed(0);
    await flow.start(activityById('shadowing')!, 'a', 10);

    expect([...practice.lines()].sort()).toEqual([...first].sort());
  });
});

describe('FlowStore freezes the level for the running session', () => {
  it('leaves the sentences alone when the profile level changes mid-activity', async () => {
    const { flow, practice, profile } = setup();

    await flow.start(activityById('shadowing')!, 'a', 10);
    const running = [...practice.lines()];
    expect(running.length).toBeGreaterThan(0);

    profile.setLevel('B1');

    expect(practice.lines()).toEqual(running);
    expect(practice.level()).toBe(TEST_LEVEL);
  });

  it('picks the new level up on the next activity', async () => {
    const { flow, practice, profile } = setup();

    await flow.start(activityById('shadowing')!, 'a', 10);
    profile.setLevel('B1');
    flow.finish();

    await flow.start(activityById('shadowing')!, null, 10);

    expect(practice.level()).toBe('B1');
    expect([...practice.lines()].sort()).toEqual(['c1', 'c2']);
  });

  it('offers the profile level\'s topics for choosing, not the running one\'s', async () => {
    const { flow, practice, profile } = setup();

    await flow.start(activityById('shadowing')!, 'a', 10);
    expect(practice.topics().map((t) => t.id)).toEqual(['a', 'b']);

    profile.setLevel('B1');

    expect(practice.topics().map((t) => t.id)).toEqual(['c']);
  });
});
