import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { activityById } from '../core/activity';
import { SENTENCE_IDS } from '../data/progress-service';
import { RANDOM } from '../platform/rng';
import { SafeStorage } from '../platform/storage';
import { CATALOG } from '../state/catalog-token';
import { FlowStore } from '../state/flow-store';
import { PracticeStore } from '../state/practice-store';
import { ProfileStore } from '../state/profile-store';
import { NO_SHUFFLE, signedOutBackend, storedProfile, TEST_CATALOG } from '../testing/catalog';
import { SettingsDrawer } from './settings-drawer';

@Component({
  imports: [SettingsDrawer],
  template: `<div appSettingsDrawer [open]="true"></div>`,
})
class Host {}

function render() {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      ...signedOutBackend(),
      { provide: SafeStorage, useValue: storedProfile() as unknown as SafeStorage },
      { provide: CATALOG, useValue: TEST_CATALOG },
      { provide: RANDOM, useValue: NO_SHUFFLE },
      { provide: SENTENCE_IDS, useValue: new Map<string, string>() },
    ],
  });

  const fixture = TestBed.createComponent(Host);
  fixture.detectChanges();
  const root = (fixture.nativeElement as HTMLElement).querySelector('.settings-drawer')!;

  return {
    fixture,
    root,
    flow: TestBed.inject(FlowStore),
    profile: TestBed.inject(ProfileStore),
    practice: TestBed.inject(PracticeStore),
    draw: () => fixture.detectChanges(),
    levels: () => [...root.querySelectorAll<HTMLButtonElement>('#profileLevels button')],
  };
}

describe('SettingsDrawer profile section', () => {
  it('offers every level in the catalog, disabling the ones with nothing behind them', () => {
    const { levels } = render();
    expect(levels().map((b) => b.dataset['levelId'])).toEqual(['A2', 'B1', 'C2']);
    // C2 carries no sentences in the test catalog.
    expect(levels()[2].disabled).toBe(true);
    expect(levels()[0].disabled).toBe(false);
  });

  it('marks the level the profile currently holds', () => {
    const { levels } = render();
    expect(levels()[0].getAttribute('aria-pressed')).toBe('true');
    expect(levels()[1].getAttribute('aria-pressed')).toBe('false');
  });

  it('exposes the levels as buttons in a labelled group, not as list items', () => {
    const { root, levels } = render();
    const group = root.querySelector('#profileLevels')!;
    expect(group.getAttribute('role')).toBe('group');
    expect(group.getAttribute('aria-label')).toMatch(/level/i);
    // role="listitem" would override the implicit button role and make
    // aria-pressed invalid, which is the defect the chooser already fixed.
    expect(levels().some((b) => b.hasAttribute('role'))).toBe(false);
  });

  it('changing the level writes it to the profile', () => {
    const { levels, draw, profile } = render();
    levels()[1].click();
    draw();

    expect(profile.levelId()).toBe('B1');
    expect(levels()[1].getAttribute('aria-pressed')).toBe('true');
  });

  it('a level with nothing behind it cannot be chosen', () => {
    const { levels, draw, profile } = render();
    levels()[2].click();
    draw();
    expect(profile.levelId()).toBe('A2');
  });

  it('leaves a running activity on the level it started with', async () => {
    const { levels, draw, flow, practice } = render();

    await flow.start(activityById('shadowing')!, 'a', 10);
    draw();
    const running = [...practice.lines()];

    levels()[1].click();
    draw();

    expect(practice.lines()).toEqual(running);
  });

  it('says the change lands on the next activity, so nobody thinks it broke', () => {
    const { root } = render();
    expect(root.querySelector('.drawer-note')?.textContent)
      .toMatch(/next activity/i);
  });
});
