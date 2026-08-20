import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { activityById } from '../core/activity';
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
function configureTestBed(): void {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      ...signedOutBackend(),
      { provide: CATALOG, useValue: TEST_CATALOG },
      { provide: RANDOM, useValue: NO_SHUFFLE },
      { provide: SafeStorage, useValue: storedProfile() as unknown as SafeStorage },
    ],
  });
}

async function renderAfterSession(activityId: string, minutes: number) {
  configureTestBed();
  const flow = TestBed.inject(FlowStore);

  await flow.start(activityById(activityId)!, 'a', minutes);
  if (activityId === 'speaking') {
    // Give the scored case something to report, so the stars stat has a value.
    TestBed.inject(SessionTimerStore).countSpoken(0);
    TestBed.inject(SessionTimerStore).recordStars(0, 4);
  }
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
    const { root, flow } = await renderAfterSession('shadowing', 10);
    expect(root.querySelector('.summary-title')?.textContent).toMatch(/Shadowing/);
    expect(root.textContent).toMatch(/10 min/);
    expect(flow.screen()).toBe('summary');
  });

  it('counts the sentences and the stars', async () => {
    const { root } = await renderAfterSession('speaking', 5);
    expect(root.querySelector('[data-stat="sentences"]')?.textContent).toMatch(/\d/);
    expect(root.querySelector('[data-stat="stars"]')).not.toBeNull();
  });

  it('omits the stars for an activity that scores nothing', async () => {
    const { root } = await renderAfterSession('listening', 5);
    expect(root.querySelector('[data-stat="stars"]')).toBeNull();
  });

  it('omits accumulated progress entirely when it cannot be read', async () => {
    const { root } = await renderAfterSession('listening', 5);
    expect(root.querySelector('.summary-progress')).toBeNull();
  });

  it('goes back to the chooser', async () => {
    const { fixture, root, flow } = await renderAfterSession('listening', 5);
    root.querySelector<HTMLButtonElement>('#backToChooser')!.click();
    fixture.detectChanges();
    expect(flow.screen()).toBe('chooser');
  });
});
