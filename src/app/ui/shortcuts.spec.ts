import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PlaybackService } from '../playback/playback-service';
import { Speaker } from '../platform/speaker';
import { SafeStorage } from '../platform/storage';
import { CATALOG } from '../state/catalog-token';
import { PracticeStore } from '../state/practice-store';
import { Shortcuts } from './shortcuts';
import { NO_SHUFFLE, storedSettings, TEST_CATALOG } from '../testing/catalog';
import { RANDOM } from '../platform/rng';

const DATA = TEST_CATALOG;

@Component({
  imports: [Shortcuts],
  template: `
    <div appShortcuts [enabled]="enabled()" [helpOpen]="helpOpen()"
      (closeHelp)="closed = closed + 1"></div>
    <input id="field">
    <select id="picker"><option>a</option></select>
    <textarea id="area"></textarea>
    <button id="btn">click me</button>
  `,
})
class Host {
  readonly enabled = signal(true);
  readonly helpOpen = signal(false);
  closed = 0;
}

function press(key: string, init: KeyboardEventInit = {}) {
  document.dispatchEvent(new KeyboardEvent('keydown', {
    key, bubbles: true, cancelable: true, ...init,
  }));
}

function pressOn(el: Element, key: string) {
  el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
}

function setup() {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      {
        provide: SafeStorage,
        useValue: storedSettings() as unknown as SafeStorage,
      },
      { provide: CATALOG, useValue: DATA },
      { provide: RANDOM, useValue: NO_SHUFFLE },
      {
        provide: Speaker,
        useValue: {
          supported: true,
          voices: () => [{ name: 'David', lang: 'en-US' }] as SpeechSynthesisVoice[],
          onVoicesChanged: () => {},
          speak: vi.fn().mockResolvedValue(undefined),
          cancel: vi.fn(),
          keepAlive: vi.fn(),
        } as unknown as Speaker,
      },
    ],
  });
  const fixture = TestBed.createComponent(Host);
  fixture.detectChanges();
  return {
    fixture,
    host: fixture.componentInstance,
    el: fixture.nativeElement as HTMLElement,
    practice: TestBed.inject(PracticeStore),
    playback: TestBed.inject(PlaybackService),
  };
}

describe('Shortcuts', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('space toggles playback', () => {
    const { playback } = setup();
    const toggle = vi.spyOn(playback, 'toggle');
    press(' ');
    expect(toggle).toHaveBeenCalledOnce();
  });

  it('ArrowRight advances', () => {
    const { playback } = setup();
    const next = vi.spyOn(playback, 'next');
    press('ArrowRight');
    expect(next).toHaveBeenCalledOnce();
  });

  it('a single ArrowLeft replays the current line without moving', () => {
    const { practice, playback } = setup();
    practice.goTo(2);
    const play = vi.spyOn(playback, 'play');
    press('ArrowLeft');
    expect(practice.index()).toBe(2);
    expect(play).toHaveBeenCalledOnce();
  });

  it('two ArrowLefts within the window step back one line', () => {
    const { practice } = setup();
    practice.goTo(2);
    press('ArrowLeft');
    vi.advanceTimersByTime(100);
    press('ArrowLeft');
    expect(practice.index()).toBe(1);
  });

  it('two ArrowLefts more than 500ms apart do not step back', () => {
    const { practice } = setup();
    practice.goTo(2);
    press('ArrowLeft');
    vi.advanceTimersByTime(600);
    press('ArrowLeft');
    expect(practice.index()).toBe(2);
  });

  it('two ArrowLefts on the first line do not move', () => {
    const { practice } = setup();
    press('ArrowLeft');
    press('ArrowLeft');
    expect(practice.index()).toBe(0);
  });

  it('any other key resets the double-press window', () => {
    const { practice } = setup();
    practice.goTo(2);
    press('ArrowLeft');
    press('Shift');
    press('ArrowLeft');

    expect(practice.index()).toBe(2);
  });

  it('ignores keys typed into form controls', () => {
    const { el, playback } = setup();
    const toggle = vi.spyOn(playback, 'toggle');
    for (const id of ['field', 'picker', 'area']) {
      pressOn(el.querySelector(`#${id}`)!, ' ');
    }
    expect(toggle).not.toHaveBeenCalled();
  });

  it('still acts on keys from a non-form element such as a button', () => {
    const { el, playback } = setup();
    const toggle = vi.spyOn(playback, 'toggle');
    pressOn(el.querySelector('#btn')!, ' ');
    expect(toggle).toHaveBeenCalledOnce();
  });

  it('ignores modified keys and auto-repeat', () => {
    const { playback } = setup();
    const toggle = vi.spyOn(playback, 'toggle');
    press(' ', { ctrlKey: true });
    press(' ', { altKey: true });
    press(' ', { metaKey: true });
    press(' ', { repeat: true });
    expect(toggle).not.toHaveBeenCalled();
  });

  it('does nothing at all while disabled', () => {
    const { fixture, host, playback } = setup();
    host.enabled.set(false);
    fixture.detectChanges();
    const toggle = vi.spyOn(playback, 'toggle');
    press(' ');
    expect(toggle).not.toHaveBeenCalled();
  });

  it('Escape closes the help modal when it is open', () => {
    const { fixture, host } = setup();
    host.helpOpen.set(true);
    fixture.detectChanges();
    press('Escape');
    expect(host.closed).toBe(1);
  });

  it('Escape does nothing when the modal is closed', () => {
    const { host } = setup();
    press('Escape');
    expect(host.closed).toBe(0);
  });

  it('cannot close the modal while disabled, matching the vanilla guard order', () => {
    const { fixture, host } = setup();
    host.enabled.set(false);
    host.helpOpen.set(true);
    fixture.detectChanges();
    press('Escape');
    expect(host.closed).toBe(0);
  });
});
