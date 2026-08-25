import { Component, type Provider } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { activityById } from '../core/activity';
import { HistoryService } from '../data/history-service';
import { RANDOM } from '../platform/rng';
import { SafeStorage } from '../platform/storage';
import { CATALOG } from '../state/catalog-token';
import { FlowStore } from '../state/flow-store';
import { SessionTimerStore } from '../state/session-timer-store';
import { NO_SHUFFLE, signedOutBackend, storedProfile, TEST_CATALOG } from '../testing/catalog';
import { SessionSummary } from './session-summary';

@Component({
  imports: [SessionSummary],
  template: `<main appSessionSummary></main>`,
})
class Host {}

// Signed out, so HistoryService returns null without touching the network and
// ProgressService never writes a row - which is what lets the shared backend
// fake get away with no insert/update.
function configureTestBed(extra: Provider[] = []): void {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      ...signedOutBackend(),
      { provide: CATALOG, useValue: TEST_CATALOG },
      { provide: RANDOM, useValue: NO_SHUFFLE },
      { provide: SafeStorage, useValue: storedProfile() as unknown as SafeStorage },
      ...extra,
    ],
  });
}

async function renderAfterSession(
  activityId: string,
  minutes: number,
  extra: Provider[] = [],
  // Stands in for the practising itself: the countdown is the only record of
  // how much of the session was spent by the time Finish is pressed.
  spend: (timer: SessionTimerStore) => void = () => {},
  topic: string | null = 'a',
) {
  configureTestBed(extra);
  const flow = TestBed.inject(FlowStore);

  await flow.start(activityById(activityId)!, topic, minutes);
  if (activityId === 'speaking') {
    // Give the scored case something to report, so the stars stat has a value.
    TestBed.inject(SessionTimerStore).countSpoken(0);
    TestBed.inject(SessionTimerStore).recordStars(0, 4);
  }
  spend(TestBed.inject(SessionTimerStore));
  flow.finish();

  const fixture = TestBed.createComponent(Host);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();

  const root = (fixture.nativeElement as HTMLElement).querySelector('.summary')!;
  return { fixture, root, flow };
}

describe('SessionSummary', () => {
  it('reports what the session was', async () => {
    const { root, flow } = await renderAfterSession('shadowing', 10, [], (timer) => {
      timer.remainingMs.set(4 * 60_000);
    });
    expect(root.querySelector('.summary-title')?.textContent).toMatch(/Shadowing/);
    expect(root.textContent).toMatch(/6 min/);
    expect(flow.screen()).toBe('summary');
  });

  it('reports the time practised, not the duration that was picked', async () => {
    // 15 minutes chosen, 90 seconds of it spent before Finish.
    const { root } = await renderAfterSession('shadowing', 15, [], (timer) => {
      timer.remainingMs.set(15 * 60_000 - 90_000);
    });

    const time = root.querySelector('[data-stat="minutes"] .summary-value');
    expect(time?.textContent?.trim()).toBe('1 min');
    expect(root.textContent).not.toMatch(/15 min/);
  });

  it('reports a session under a minute in seconds instead of claiming zero', async () => {
    const { root } = await renderAfterSession('shadowing', 5, [], (timer) => {
      timer.remainingMs.set(5 * 60_000 - 20_000);
    });

    const time = root.querySelector('[data-stat="minutes"] .summary-value');
    expect(time?.textContent?.trim()).toBe('20 sec');
  });

  it('counts the sentences and the stars', async () => {
    // The setup speaks exactly one line and scores it four stars.
    const { root } = await renderAfterSession('speaking', 5);

    const sentences = root.querySelector('[data-stat="sentences"]')!;
    expect(sentences.querySelector('.summary-value')?.textContent?.trim()).toBe('1');
    expect(sentences.querySelector('.summary-label')?.textContent?.trim()).toBe('sentence');

    const stars = root.querySelector('[data-stat="stars"]')!;
    expect(stars.querySelector('.summary-value')?.textContent?.trim()).toBe('4★');
  });

  it('names the topic that was practised, not just the activity', async () => {
    const { root } = await renderAfterSession('shadowing', 10);
    expect(root.querySelector('.summary-title')?.textContent).toBe('Shadowing · A');
  });

  it('says All topics when the session was never narrowed to one', async () => {
    const { root } = await renderAfterSession('shadowing', 10, [], () => {}, null);
    expect(root.querySelector('.summary-title')?.textContent).toBe('Shadowing · All topics');
  });

  it('names no topic for My text, which has none', async () => {
    const { root } = await renderAfterSession('custom', 10, [], () => {}, null);
    expect(root.querySelector('.summary-title')?.textContent).toBe('My text');
  });

  it('averages the stars over the sentences practised', async () => {
    // The setup scores line 0 four stars; this adds a second at three.
    const { root } = await renderAfterSession('speaking', 5, [], (timer) => {
      timer.countSpoken(1);
      timer.recordStars(1, 3);
    });

    const average = root.querySelector('[data-stat="average"]')!;
    expect(average.querySelector('.summary-value')?.textContent?.trim()).toBe('3.5★');
    expect(average.querySelector('.summary-label')?.textContent?.trim()).toBe('per sentence');
  });

  it('omits the average wherever it omits the stars', async () => {
    const { root } = await renderAfterSession('listening', 5);
    expect(root.querySelector('[data-stat="stars"]')).toBeNull();
    expect(root.querySelector('[data-stat="average"]')).toBeNull();
  });

  it('omits the stars when nothing was scored, rather than showing zero', async () => {
    const { root } = await renderAfterSession('listening', 5);
    expect(root.querySelector('[data-stat="stars"]')).toBeNull();
  });

  it('omits accumulated progress entirely when it cannot be read', async () => {
    const { root } = await renderAfterSession('listening', 5);
    expect(root.querySelector('.summary-progress')).toBeNull();
  });

  it('shows the accumulated progress once it has been read', async () => {
    const { root } = await renderAfterSession('listening', 5, [
      {
        provide: HistoryService,
        useValue: {
          accumulated: () => Promise.resolve({
            currentStreak: 4,
            longestStreak: 11,
          }),
        },
      },
    ]);

    expect(root.querySelector('.summary-progress')).not.toBeNull();
    // Asserted in position, so swapping the streaks
    // fails here - the compiler is happy with either arrangement.
    const streak = root.querySelector('[data-stat="streak"]')!;
    expect(streak.querySelector('.summary-value')?.textContent?.trim()).toBe('4');
    expect(streak.querySelector('.summary-label')?.textContent).toMatch(/day streak · best 11/);

    // The level's mastered count was removed: it read 0 / 0 for anyone whose
    // progress rows did not exist yet, and 0 forever for the unscored
    // activities, which is discouraging rather than informative.
    expect(root.querySelector('[data-stat="mastered"]')).toBeNull();
  });

  it('goes back to the chooser', async () => {
    const { fixture, root, flow } = await renderAfterSession('listening', 5);
    root.querySelector<HTMLButtonElement>('#backToChooser')!.click();
    fixture.detectChanges();
    expect(flow.screen()).toBe('chooser');
  });
});
