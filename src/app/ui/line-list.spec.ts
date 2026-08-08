import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { type Corpus } from '../core/deck';
import { MicrophoneService } from '../platform/microphone';
import {
  type RecognitionOptions, type RecognitionSession, SpeechRecognizer,
} from '../platform/speech-recognition';
import { Speaker } from '../platform/speaker';
import { SafeStorage } from '../platform/storage';
import { CORPUS_DATA } from '../state/corpus-token';
import { PracticeStore } from '../state/practice-store';
import { SettingsStore } from '../state/settings-store';
import { ValidationService } from '../validation/validation-service';
import { LineList } from './line-list';

const DATA: Corpus = {
  generatedAt: '2026-08-06T00:00:00Z',
  decks: [{
    id: 'a',
    name: 'A',
    lines: ['plain one', 'with <b>a chunk</b> inside', 'third'],
  }],
};

@Component({
  imports: [LineList],
  template: `<div appLineList></div>`,
})
class Host {}

function fakeRecognizer() {
  let opts: RecognitionOptions = {};
  return {
    opts: () => opts,
    impl: {
      supported: () => true,
      recognize: (o: RecognitionOptions) => {
        opts = o;
        return { start() {}, stop() {}, abort() {} } as RecognitionSession;
      },
    } as unknown as SpeechRecognizer,
  };
}

function render() {
  const recognizer = fakeRecognizer();
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
      { provide: SpeechRecognizer, useValue: recognizer.impl },
      {
        provide: MicrophoneService,
        useValue: {
          denied: () => false,
          ensure: () => Promise.resolve({}),
          markDenied() {},
          release() {},
        } as unknown as MicrophoneService,
      },
    ],
  });
  const fixture = TestBed.createComponent(Host);
  fixture.detectChanges();
  return {
    fixture,
    recognizer,
    lines: (fixture.nativeElement as HTMLElement).querySelector('.lines')!,
    practice: TestBed.inject(PracticeStore),
    settings: TestBed.inject(SettingsStore),
    validation: TestBed.inject(ValidationService),
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

describe('LineList validator results', () => {
  it('shows no boxes until a line has a result', () => {
    expect(render().lines.querySelectorAll('.validate-box').length).toBe(0);
  });

  it('renders a box after its own line, keeping one per practised line', () => {
    const { fixture, lines, validation } = render();
    validation.begin(0, 'plain one');
    validation.begin(2, 'third');
    fixture.detectChanges();

    const boxes = [...lines.querySelectorAll('.validate-box')];
    expect(boxes.length).toBe(2);
    expect(boxes[0].previousElementSibling?.querySelector('.num')?.textContent).toBe('1');
    expect(boxes[1].previousElementSibling?.querySelector('.num')?.textContent).toBe('3');
  });

  it('gives each box its own transcript and stars', () => {
    const { fixture, lines, validation, recognizer } = render();
    validation.begin(0, 'plain one');
    recognizer.opts().onResult?.('plain one');
    validation.begin(1, 'with a chunk inside');
    recognizer.opts().onResult?.('with a chunk');
    fixture.detectChanges();

    const boxes = [...lines.querySelectorAll('.validate-box')];
    expect(boxes[0].querySelector('.transcript')?.textContent).toBe('plain one');
    expect(boxes[0].querySelector('.stars')?.textContent).toBe('★★★★★');
    expect(boxes[1].querySelector('.transcript')?.textContent).toBe('with a chunk');
    expect(boxes[1].querySelector('.stars')?.textContent).not.toBe('★★★★★');
  });

  it('only the line being listened to carries the listening status', () => {
    const { fixture, lines, validation, recognizer } = render();
    validation.begin(0, 'plain one');
    recognizer.opts().onResult?.('plain one');
    validation.begin(1, 'with a chunk inside');
    fixture.detectChanges();

    const boxes = [...lines.querySelectorAll('.validate-box')];
    expect(boxes[0].classList.contains('scored')).toBe(true);
    expect(boxes[0].classList.contains('listening')).toBe(false);
    expect(boxes[1].classList.contains('listening')).toBe(true);
  });

  it('drops every box when the history is reset', () => {
    const { fixture, lines, validation } = render();
    validation.begin(0, 'plain one');
    fixture.detectChanges();
    expect(lines.querySelectorAll('.validate-box').length).toBe(1);

    validation.reset();
    fixture.detectChanges();
    expect(lines.querySelectorAll('.validate-box').length).toBe(0);
  });
});
