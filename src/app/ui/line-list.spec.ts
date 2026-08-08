import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { type Corpus } from '../core/deck';
import { Speaker } from '../platform/speaker';
import { SafeStorage } from '../platform/storage';
import { CORPUS_DATA } from '../state/corpus-token';
import { PracticeStore } from '../state/practice-store';
import { SettingsStore } from '../state/settings-store';
import { LineList } from './line-list';

const DATA: Corpus = {
  generatedAt: '2026-08-06T00:00:00Z',
  decks: [{
    id: 'a',
    name: 'A',
    lines: ['plain one', 'with <b>a chunk</b> inside', 'third'],
  }],
};

/** Rendered through real markup so the host stays a <div class="lines">. */
@Component({
  imports: [LineList],
  template: `<div appLineList></div>`,
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
          supported: true,
          voices: () => [],
          onVoicesChanged: () => {},
          speak: () => Promise.resolve(),
          cancel: () => {},
          keepAlive: () => {},
        } as unknown as Speaker,
      },
    ],
  });
  const fixture = TestBed.createComponent(Host);
  fixture.detectChanges();
  return {
    fixture,
    lines: (fixture.nativeElement as HTMLElement).querySelector('.lines')!,
    practice: TestBed.inject(PracticeStore),
    settings: TestBed.inject(SettingsStore),
  };
}

describe('LineList structure', () => {
  it('renders as <div class="lines" id="lines">', () => {
    const { lines } = render();
    expect(lines.tagName).toBe('DIV');
    expect(lines.classList.contains('lines')).toBe(true);
    expect(lines.id).toBe('lines');
  });

  it('renders one <p> per line, numbered from 1', () => {
    const { lines } = render();
    expect(lines.querySelectorAll('p').length).toBe(3);
    expect([...lines.querySelectorAll('p .num')].map((n) => n.textContent))
      .toEqual(['1', '2', '3']);
  });

  it('renders the chunk markup inside .text', () => {
    const { lines } = render();
    const text = lines.querySelectorAll('p .text')[1];
    expect(text.querySelector('b')?.textContent).toBe('a chunk');
  });

  it('renumbers from one after a deck change', () => {
    const { fixture, lines, practice } = render();
    practice.selectDeck('a');
    fixture.detectChanges();
    expect([...lines.querySelectorAll('p .num')].map((n) => n.textContent))
      .toEqual(['1', '2', '3']);
  });
});

describe('LineList state classes', () => {
  it('marks the current line', () => {
    const { fixture, lines, practice } = render();
    expect(lines.querySelector('p.current .num')?.textContent).toBe('1');

    practice.goTo(2);
    fixture.detectChanges();
    expect(lines.querySelector('p.current .num')?.textContent).toBe('3');
  });

  it('marks spoken lines', () => {
    const { fixture, lines, practice } = render();
    practice.markSpoken(1);
    fixture.detectChanges();
    const ps = [...lines.querySelectorAll('p')];
    expect(ps[0].classList.contains('spoken')).toBe(false);
    expect(ps[1].classList.contains('spoken')).toBe(true);
  });

  it('toggles the blurred class from the blur setting', () => {
    const { fixture, lines, settings } = render();
    expect(lines.classList.contains('blurred')).toBe(false);
    settings.setBlur(true);
    fixture.detectChanges();
    expect(lines.classList.contains('blurred')).toBe(true);
  });
});

describe('LineList interaction', () => {
  it('clicking anywhere in a line selects it, including the number', () => {
    const { fixture, lines, practice } = render();
    lines.querySelectorAll<HTMLElement>('p .num')[2].click();
    fixture.detectChanges();
    expect(practice.index()).toBe(2);
    expect(lines.querySelector('p.current .num')?.textContent).toBe('3');
  });
});
