import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { HistoryService } from '../data/history-service';
import { SENTENCE_IDS } from '../data/progress-service';
import { RANDOM } from '../platform/rng';
import {
  SPEECH_RECOGNITION_CTOR, type SpeechRecognitionCtor,
} from '../platform/speech-recognition';
import { SafeStorage } from '../platform/storage';
import { CATALOG } from '../state/catalog-token';
import { FlowStore } from '../state/flow-store';
import { SettingsStore } from '../state/settings-store';
import { NO_SHUFFLE, TEST_CATALOG } from '../testing/catalog';
import { ActivityChooser } from './activity-chooser';

@Component({
  imports: [ActivityChooser],
  template: `<main appActivityChooser></main>`,
})
class Host {}



class FakeRecognition {
  lang = '';
  continuous = false;
  interimResults = false;
  maxAlternatives = 1;
  onresult: unknown = null;
  onerror: unknown = null;
  onend: unknown = null;
  start(): void {}
  stop(): void {}
  abort(): void {}
}

function render(extra: unknown[] = []) {
  const store = new Map<string, unknown>();

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      ...(extra as never[]),
      { provide: CATALOG, useValue: TEST_CATALOG },
      { provide: RANDOM, useValue: NO_SHUFFLE },
      { provide: SENTENCE_IDS, useValue: new Map<string, string>() },
      { provide: SPEECH_RECOGNITION_CTOR, useValue: FakeRecognition as unknown as SpeechRecognitionCtor },
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
  it('offers exactly the two practice kinds', () => {
    const { cards } = render();
    expect(cards().map((c) => c.dataset['kindId'])).toEqual(['speaking', 'dictation']);
  });

  it('explains each kind in one line', () => {
    const { cards } = render();
    expect(cards()[0].textContent).toMatch(/Say each sentence out loud/i);
    expect(cards()[1].textContent).toMatch(/Listen, type what you hear/i);
  });

  it('does not suggest anything yet, and cannot start until a kind is picked', () => {
    const { cards, start } = render();
    expect(cards().some((c) => c.getAttribute('aria-pressed') === 'true')).toBe(false);
    expect(start().disabled).toBe(true);
  });

  it('picking a kind marks it, shows the topic source, and Start still needs a topic', () => {
    const { fixture, cards, root, start } = render();

    cards()[0].click();
    fixture.detectChanges();

    expect(cards()[0].getAttribute('aria-pressed')).toBe('true');
    expect(root.querySelector('#decks')).not.toBeNull();
    expect(start().disabled).toBe(true);

    root.querySelector<HTMLButtonElement>('[data-deck-id="b"]')!.click();
    fixture.detectChanges();
    expect(start().disabled).toBe(false);
  });

  it('counts All topics as a topic pick', () => {
    const { fixture, cards, root, start } = render();

    cards()[0].click();
    fixture.detectChanges();
    root.querySelector<HTMLButtonElement>('#allTopics')!.click();
    fixture.detectChanges();

    expect(start().disabled).toBe(false);
  });

  it('keeps both cards enabled here, since the browser can transcribe speech', () => {
    const { cards } = render();
    expect(cards().some((c) => c.disabled)).toBe(false);
  });

  it('swaps the pane as the source tab changes', () => {
    const { fixture, cards, root } = render();
    cards()[0].click();
    fixture.detectChanges();

    expect([...root.querySelectorAll('.source-tabs button')].map((b) => b.textContent?.trim()))
      .toEqual(['Topic', 'My text']);
    expect(root.querySelector('#decks')).not.toBeNull();

    root.querySelector<HTMLButtonElement>('#srcCustom')!.click();
    fixture.detectChanges();
    expect(root.querySelector('#decks')).toBeNull();
    expect(root.querySelector('.custom-topic')).not.toBeNull();

    root.querySelector<HTMLButtonElement>('#srcCatalog')!.click();
    fixture.detectChanges();
    expect(root.querySelector('#decks')).not.toBeNull();
  });

  it('needs custom text before Start on the My text source', () => {
    const { fixture, cards, root, start } = render();

    cards()[0].click();
    fixture.detectChanges();
    root.querySelector<HTMLButtonElement>('#srcCustom')!.click();
    fixture.detectChanges();

    expect(start().disabled).toBe(true);

    const area = root.querySelector<HTMLTextAreaElement>('#customText')!;
    area.value = 'A sentence to practise.';
    area.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    root.querySelector<HTMLButtonElement>('#customSave')!.click();
    fixture.detectChanges();

    expect(start().disabled).toBe(false);
  });

  it('starting hands the flow store the kind, source, topic and duration', async () => {
    const { fixture, cards, durations, root, start, flow, settings } = render();

    cards()[0].click();
    fixture.detectChanges();
    root.querySelector<HTMLButtonElement>('[data-deck-id="b"]')!.click();
    durations()[2].click();
    fixture.detectChanges();

    start().click();
    await fixture.whenStable();

    expect(flow.screen()).toBe('practice');
    expect(flow.kind()).toBe('speaking');
    expect(settings.topicId()).toBe('b');
    expect(settings.durationMin()).toBe(15);
  });

  it('a dictation session lands on the dictation screen with no topic', async () => {
    const { fixture, cards, root, start, flow, settings } = render();

    cards()[1].click();
    fixture.detectChanges();
    root.querySelector<HTMLButtonElement>('#allTopics')!.click();
    fixture.detectChanges();

    start().click();
    await fixture.whenStable();

    expect(flow.screen()).toBe('dictation');
    expect(flow.kind()).toBe('dictation');
    expect(settings.topicId()).toBeNull();
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
      useValue: {
        totals: () => totals as ReturnType<HistoryService['totals']>,
        progress: () => new Map(),
      } as unknown as HistoryService,
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
    
    expect(root.querySelector('[data-panel="all"] [data-stat="days"]')?.textContent)
      .toMatch(/47/);
  });
});