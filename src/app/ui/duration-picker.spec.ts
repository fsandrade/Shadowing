import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { type Corpus } from '../core/deck';
import { Speaker } from '../platform/speaker';
import { SafeStorage } from '../platform/storage';
import { CORPUS_DATA } from '../state/corpus-token';
import { SettingsStore } from '../state/settings-store';
import { DurationPicker } from './duration-picker';

const DATA: Corpus = {
  generatedAt: '2026-08-06T00:00:00Z',
  decks: [{ id: 'a', name: 'A', lines: ['one'] }],
};

/** Rendered through real markup so the host stays a <div class="durations">. */
@Component({
  imports: [DurationPicker],
  template: `<div appDurationPicker></div>`,
})
class Host {}

function render() {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      {
        provide: SafeStorage,
        useValue: { read: () => null, write: () => {} } as unknown as SafeStorage,
      },
      { provide: CORPUS_DATA, useValue: DATA },
      {
        provide: Speaker,
        useValue: {
          supported: true, voices: () => [], onVoicesChanged: () => {},
          speak: () => Promise.resolve(), cancel: () => {}, keepAlive: () => {},
        } as unknown as Speaker,
      },
    ],
  });
  const fixture = TestBed.createComponent(Host);
  fixture.detectChanges();
  const root = fixture.nativeElement as HTMLElement;
  return {
    fixture,
    durations: root.querySelector('.durations')!,
    settings: TestBed.inject(SettingsStore),
    buttons: () => [...root.querySelectorAll<HTMLButtonElement>('.durations button')],
  };
}

describe('DurationPicker', () => {
  it('renders as <div class="durations" id="durations">', () => {
    const { durations } = render();
    expect(durations.classList.contains('durations')).toBe(true);
    expect(durations.id).toBe('durations');
  });

  it('offers 5, 10, 15 and unlimited with the vanilla data-min values', () => {
    expect(render().buttons().map((b) => b.dataset['min'])).toEqual(['5', '10', '15', '0']);
  });

  it('gives the first button a title mentioning minutes', () => {
    expect(render().buttons()[0].title).toBe('Set a 5-minute session');
  });

  it('labels the unlimited option with an infinity sign', () => {
    const buttons = render().buttons();
    expect(buttons[3].textContent?.trim()).toBe('∞');
    expect(buttons[3].title).toBe('Practice with no time limit');
  });

  it('starts with unlimited pressed', () => {
    const pressed = render().buttons()
      .filter((b) => b.getAttribute('aria-pressed') === 'true');
    expect(pressed.map((b) => b.dataset['min'])).toEqual(['0']);
  });

  it('moves aria-pressed and updates the setting on click', () => {
    const { fixture, buttons, settings } = render();
    buttons()[1].click();
    fixture.detectChanges();

    expect(settings.durationMin()).toBe(10);
    expect(buttons().filter((b) => b.getAttribute('aria-pressed') === 'true')
      .map((b) => b.dataset['min'])).toEqual(['10']);
  });
});
