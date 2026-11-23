import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { SENTENCE_IDS } from '../data/progress-service';
import { RANDOM } from '../platform/rng';
import { SafeStorage } from '../platform/storage';
import { CATALOG } from '../state/catalog-token';
import { SettingsStore } from '../state/settings-store';
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
    settings: TestBed.inject(SettingsStore),
    draw: () => fixture.detectChanges(),
    reset: () => root.querySelector<HTMLButtonElement>('#resetPacing')!,
  };
}

describe('SettingsDrawer playback reset', () => {
  it('is disabled while speed and gap are already at their defaults', () => {
    const { reset } = render();
    expect(reset().disabled).toBe(true);
  });

  it('returns speed and gap to 1', () => {
    const { settings, reset, draw } = render();
    settings.setRate(0.8);
    settings.setSlack(2);
    draw();

    expect(reset().disabled).toBe(false);
    reset().click();
    draw();

    expect(settings.rate()).toBe(1);
    expect(settings.slack()).toBe(1);
    expect(reset().disabled).toBe(true);
  });

  it('no longer offers a profile level picker', () => {
    const { root } = render();
    expect(root.querySelector('#profileLevels')).toBeNull();
  });
});
