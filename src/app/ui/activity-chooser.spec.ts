import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { SENTENCE_IDS } from '../data/progress-service';
import { INITIAL_USER } from '../platform/auth';
import { RANDOM } from '../platform/rng';
import { SafeStorage } from '../platform/storage';
import { SUPABASE } from '../platform/supabase-client';
import { CATALOG } from '../state/catalog-token';
import { FlowStore } from '../state/flow-store';
import { SettingsStore } from '../state/settings-store';
import { NO_SHUFFLE, TEST_CATALOG, TEST_LEVEL } from '../testing/catalog';
import { ActivityChooser } from './activity-chooser';

@Component({
  imports: [ActivityChooser],
  template: `<main appActivityChooser></main>`,
})
class Host {}

function render() {
  const store = new Map<string, unknown>([['shadowing.profile', { levelId: TEST_LEVEL }]]);

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: CATALOG, useValue: TEST_CATALOG },
      { provide: RANDOM, useValue: NO_SHUFFLE },
      { provide: INITIAL_USER, useValue: null },
      { provide: SENTENCE_IDS, useValue: new Map<string, string>() },
      {
        provide: SUPABASE,
        useValue: {
          from: () => ({
            select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }) }),
            upsert: () => Promise.resolve({ error: null }),
            insert: () => Promise.resolve({ error: null, status: 201 }),
            update: () => ({ eq: () => Promise.resolve({ error: null, status: 204 }) }),
          }),
          auth: { onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) },
        } as unknown as SupabaseClient,
      },
      {
        provide: SafeStorage,
        useValue: {
          read: (key: string) => store.get(key) ?? null,
          write: (key: string, value: unknown) => { store.set(key, value); },
        } as unknown as SafeStorage,
      },
    ],
  });

  const fixture = TestBed.createComponent(Host);
  fixture.detectChanges();
  const root = (fixture.nativeElement as HTMLElement).querySelector('.chooser')!;
  const q = <T extends HTMLElement>(sel: string) => root.querySelector<T>(sel)!;

  return {
    fixture,
    root,
    q,
    flow: TestBed.inject(FlowStore),
    settings: TestBed.inject(SettingsStore),
    cards: () => [...root.querySelectorAll<HTMLButtonElement>('.activity-card')],
    durations: () => [...root.querySelectorAll<HTMLButtonElement>('.durations button')],
    start: () => q<HTMLButtonElement>('#startActivity'),
  };
}

describe('ActivityChooser', () => {
  it('offers every activity, My text included', () => {
    const { cards } = render();
    expect(cards().map((c) => c.dataset['activityId']))
      .toEqual(['listening', 'shadowing', 'speaking', 'spelling', 'custom']);
  });

  it('explains each activity in one line', () => {
    const { cards } = render();
    expect(cards()[0].textContent).toMatch(/Train your ear/i);
    expect(cards()[4].textContent).toMatch(/never counts|Nothing here counts/i);
  });

  it('does not suggest anything yet, and cannot start until an activity is picked', () => {
    const { cards, start } = render();
    expect(cards().some((c) => c.getAttribute('aria-pressed') === 'true')).toBe(false);
    expect(start().disabled).toBe(true);
  });

  it('picking an activity marks it and enables Start', () => {
    const { fixture, cards, start } = render();
    cards()[0].click();
    fixture.detectChanges();
    expect(cards()[0].getAttribute('aria-pressed')).toBe('true');
    expect(start().disabled).toBe(false);
  });

  it('offers three durations and defaults to ten minutes', () => {
    const { fixture, cards, durations } = render();
    cards()[0].click();
    fixture.detectChanges();
    expect(durations().map((b) => b.textContent?.trim())).toEqual(['5 min', '10 min', '15 min']);
    expect(durations()[1].getAttribute('aria-pressed')).toBe('true');
  });

  it('shows the topics at the learner\'s level, with All topics first', () => {
    const { fixture, cards, root } = render();
    cards()[0].click();
    fixture.detectChanges();
    const topics = [...root.querySelectorAll<HTMLButtonElement>('#decks button')];
    expect(topics[0].textContent?.trim()).toBe('All topics');
    expect(topics.slice(1).map((b) => b.dataset['deckId'])).toEqual(['a', 'b']);
  });

  it('starting hands the flow store the activity, topic and duration', async () => {
    const { fixture, cards, durations, root, start, flow, settings } = render();

    cards()[1].click();
    fixture.detectChanges();
    root.querySelector<HTMLButtonElement>('[data-deck-id="b"]')!.click();
    durations()[2].click();
    fixture.detectChanges();

    start().click();
    await fixture.whenStable();

    expect(flow.screen()).toBe('practice');
    expect(flow.activity()?.id).toBe('shadowing');
    expect(settings.topicId()).toBe('b');
    expect(settings.durationMin()).toBe(15);
  });

  it('swaps the topic list for the editor and a check-mode choice on My text', () => {
    const { fixture, cards, root } = render();
    cards()[4].click();
    fixture.detectChanges();

    expect(root.querySelector('#decks')).toBeNull();
    expect(root.querySelector('.custom-topic')).not.toBeNull();
    expect(root.querySelector('.check-mode')).not.toBeNull();
  });
});
