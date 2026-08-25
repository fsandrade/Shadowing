import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { HistoryService } from '../data/history-service';
import { SENTENCE_IDS } from '../data/progress-service';
import { INITIAL_USER } from '../platform/auth';
import { RANDOM } from '../platform/rng';
import { SafeStorage } from '../platform/storage';
import { SUPABASE } from '../platform/supabase-client';
import { CATALOG } from '../state/catalog-token';
import { FlowStore } from '../state/flow-store';
import { SettingsStore } from '../state/settings-store';
import { NO_SHUFFLE, TEST_CATALOG, TEST_LEVEL } from '../testing/catalog';
import { ValidationService } from '../validation/validation-service';
import { ActivityChooser } from './activity-chooser';

@Component({
  imports: [ActivityChooser],
  template: `<main appActivityChooser></main>`,
})
class Host {}

function render(extra: unknown[] = []) {
  const store = new Map<string, unknown>([['shadowing.profile', { levelId: TEST_LEVEL }]]);

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      ...(extra as never[]),
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
    validation: TestBed.inject(ValidationService),
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

  it('offers four durations, unlimited last, and defaults to ten minutes', () => {
    const { fixture, cards, durations } = render();
    cards()[0].click();
    fixture.detectChanges();
    expect(durations().map((b) => b.textContent?.trim()))
      .toEqual(['5 min', '10 min', '15 min', 'Unlimited']);
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

  it('carries the check mode chosen for My text into the session', async () => {
    // The control below the editor applies the mode as it is clicked, so begin()
    // has to hand it to start(). Dropping that argument would fall back to the
    // custom preset, 'nothing', and silently undo the learner.
    const { fixture, cards, root, flow, validation } = render();

    cards()[4].click();
    fixture.detectChanges();

    root.querySelector<HTMLButtonElement>('#check-spelling')!.click();
    await fixture.whenStable();
    expect(validation.mode()).toBe('spelling');

    root.querySelector<HTMLButtonElement>('#startActivity')!.click();
    await fixture.whenStable();

    expect(flow.screen()).toBe('practice');
    expect(validation.mode()).toBe('spelling');
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

describe('ActivityChooser unlimited sessions', () => {
  it('starts an unlimited session with a zero duration', async () => {
    const { fixture, cards, durations, root, start, settings } = render();

    cards()[0].click();
    fixture.detectChanges();
    root.querySelector<HTMLButtonElement>('#allTopics')!.click();
    durations()[3].click();
    fixture.detectChanges();

    start().click();
    await fixture.whenStable();

    expect(settings.durationMin()).toBe(0);
  });

  it('says the session runs until the learner ends it', () => {
    const { fixture, cards, durations } = render();
    cards()[0].click();
    fixture.detectChanges();
    expect(durations()[3].title).toMatch(/until you finish/i);
  });
});

describe('ActivityChooser practice panels', () => {
  const FULL = {
    currentStreak: 12,
    longestStreak: 20,
    daysStudied: 47,
    practisedMs: 6 * 60 * 60_000 + 20 * 60_000,
    sentencesPractised: 1312,
    sentencesDistinct: 431,
    averageStars: 3.8,
    today: {
      practisedMs: 14 * 60_000,
      sentencesPractised: 38,
      sentencesDistinct: 22,
      averageStars: 4.1,
    },
  };

  async function renderWith(totals: unknown) {
    const r = render([{
      provide: HistoryService,
      useValue: { totals: () => Promise.resolve(totals) } as unknown as HistoryService,
    }]);
    r.fixture.detectChanges();
    await r.fixture.whenStable();
    r.fixture.detectChanges();
    return r;
  }

  it('shows nothing at all when the totals cannot be read', async () => {
    const { root } = await renderWith(null);
    expect(root.querySelector('.panels')).toBeNull();
  });

  it('reports the all-time figures', async () => {
    const { root } = await renderWith(FULL);
    const panel = root.querySelector('[data-panel="all"]')!;

    expect(panel.querySelector('[data-stat="streak"]')?.textContent).toMatch(/12/);
    expect(panel.querySelector('[data-stat="streak"]')?.textContent).toMatch(/best 20/);
    expect(panel.querySelector('[data-stat="days"]')?.textContent).toMatch(/47/);
    expect(panel.querySelector('[data-stat="time"]')?.textContent).toMatch(/6h 20m/);
    expect(panel.querySelector('[data-stat="sentences"]')?.textContent).toMatch(/1312/);
    expect(panel.querySelector('[data-stat="sentences"]')?.textContent).toMatch(/431/);
    expect(panel.querySelector('[data-stat="average"]')?.textContent).toMatch(/3\.8/);
  });

  it('reports today without the day counts, which make no sense for one day', async () => {
    const { root } = await renderWith(FULL);
    const panel = root.querySelector('[data-panel="today"]')!;

    expect(panel.querySelector('[data-stat="time"]')?.textContent).toMatch(/14m/);
    expect(panel.querySelector('[data-stat="sentences"]')?.textContent).toMatch(/38/);
    expect(panel.querySelector('[data-stat="average"]')?.textContent).toMatch(/4\.1/);
    expect(panel.querySelector('[data-stat="streak"]')).toBeNull();
    expect(panel.querySelector('[data-stat="days"]')).toBeNull();
  });

  it('calls the sentence figures scored, so an unscored week does not read as broken', async () => {
    const { root } = await renderWith(FULL);
    expect(root.querySelector('.panels')?.textContent).toMatch(/scored/i);
  });

  it('omits the average when nothing has been scored, rather than showing zero', async () => {
    const { root } = await renderWith({
      ...FULL,
      sentencesPractised: 0,
      averageStars: null,
      today: { ...FULL.today, sentencesPractised: 0, averageStars: null },
    });

    expect(root.querySelector('[data-panel="all"] [data-stat="average"]')).toBeNull();
    expect(root.querySelector('[data-panel="today"] [data-stat="average"]')).toBeNull();
    // Days and minutes still count, which is the whole point.
    expect(root.querySelector('[data-panel="all"] [data-stat="days"]')?.textContent)
      .toMatch(/47/);
  });
});
