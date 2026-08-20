import { TestBed } from '@angular/core/testing';
import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { activityById } from '../core/activity';
import { ProgressService, SENTENCE_IDS } from '../data/progress-service';
import { INITIAL_USER } from '../platform/auth';
import { RANDOM } from '../platform/rng';
import { SafeStorage } from '../platform/storage';
import { SUPABASE } from '../platform/supabase-client';
import { NO_SHUFFLE, TEST_CATALOG, TEST_LEVEL } from '../testing/catalog';
import { CATALOG } from './catalog-token';
import { FlowStore } from './flow-store';
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

function setup(opts: { level?: string | null } = {}) {
  const level = opts.level === undefined ? TEST_LEVEL : opts.level;
  const store = new Map<string, unknown>([
    ['shadowing.profile', level === null ? { levelId: null } : { levelId: level }],
  ]);

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: CATALOG, useValue: TEST_CATALOG },
      { provide: RANDOM, useValue: NO_SHUFFLE },
      { provide: SUPABASE, useValue: fakeSupabase() },
      { provide: INITIAL_USER, useValue: null },
      { provide: SENTENCE_IDS, useValue: new Map<string, string>() },
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
});

describe('FlowStore finishing', () => {
  it('reports what the session was and what came of it', async () => {
    const { flow } = setup();
    await flow.start(activityById('shadowing')!, 'a', 15);

    flow.finish();

    const result = flow.result()!;
    expect(result.activity.id).toBe('shadowing');
    expect(result.topicId).toBe('a');
    expect(result.minutes).toBe(15);
    expect(result.spoken).toBe(0);
    expect(result.stars).toBeNull();
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
