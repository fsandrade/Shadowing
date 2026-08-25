import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { activityById } from '../core/activity';
import { RANDOM } from '../platform/rng';
import { SafeStorage } from '../platform/storage';
import { CATALOG } from '../state/catalog-token';
import { FlowStore } from '../state/flow-store';
import { NO_SHUFFLE, signedOutBackend, storedProfile, TEST_CATALOG } from '../testing/catalog';
import { HeaderBar } from './header-bar';

@Component({
  imports: [HeaderBar],
  template: `<header appHeaderBar></header>`,
})
class Host {}

function render() {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      ...signedOutBackend(),
      { provide: CATALOG, useValue: TEST_CATALOG },
      { provide: RANDOM, useValue: NO_SHUFFLE },
      { provide: SafeStorage, useValue: storedProfile() as unknown as SafeStorage },
    ],
  });

  const flow = TestBed.inject(FlowStore);
  const fixture = TestBed.createComponent(Host);
  const root = fixture.nativeElement as HTMLElement;
  const draw = () => fixture.detectChanges();
  draw();

  return { fixture, flow, draw, clock: () => root.querySelector('#clock') };
}

describe('HeaderBar session clock', () => {
  it('is absent on the chooser, where no session is running', () => {
    const { flow, clock } = render();
    expect(flow.screen()).toBe('chooser');
    expect(clock()).toBeNull();
  });

  it('appears while an activity is running, counting its duration down', async () => {
    const { flow, draw, clock } = render();

    await flow.start(activityById('listening')!, 'a', 15);
    draw();

    expect(clock()?.textContent).toBe('15:00');
    expect(clock()?.getAttribute('title')).toBe('Time left in this 15-minute session');
  });

  it('is gone again on the summary, rather than offering a fresh 15:00', async () => {
    const { flow, draw, clock } = render();

    await flow.start(activityById('listening')!, 'a', 15);
    flow.finish();
    draw();

    expect(flow.screen()).toBe('summary');
    // finish() puts a full duration back on the timer, so a clock rendered
    // here would tell the learner they still have all of it left.
    expect(clock()).toBeNull();
  });
});

describe('HeaderBar clock with no time limit', () => {
  it('counts up from zero and says so, rather than promising time left', async () => {
    const { flow, draw, clock } = render();

    await flow.start(activityById('listening')!, 'a', 0);
    draw();

    expect(clock()?.textContent).toBe('00:00');
    expect(clock()?.getAttribute('title')).toBe('Time spent practising');
  });
});
