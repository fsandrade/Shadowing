import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { MicrophoneService } from '../platform/microphone';
import {
  type RecognitionOptions, type RecognitionSession, SpeechRecognizer,
} from '../platform/speech-recognition';
import { Speaker } from '../platform/speaker';
import { SafeStorage } from '../platform/storage';
import { CATALOG } from '../state/catalog-token';
import { CustomTopicStore } from '../state/custom-topic-store';
import { PracticeStore } from '../state/practice-store';
import { SettingsStore } from '../state/settings-store';
import { ValidationService } from '../validation/validation-service';
import { LineList } from './line-list';
import { NO_SHUFFLE, signedOutBackend, storedProfile } from '../testing/catalog';
import type { Catalog } from '../core/catalog';
import { RANDOM } from '../platform/rng';

const DATA: Catalog = {
  loadedAt: '2026-08-06T00:00:00Z',
  levels: [{ id: 'A2', description: 'Elementary' }],
  topics: [{ id: 'a', name: 'A' }],
  sentences: [
    { id: 's-0', topicId: 'a', levelId: 'A2', text: 'plain one' },
    { id: 's-1', topicId: 'a', levelId: 'A2', text: 'with <b>a chunk</b> inside' },
    { id: 's-2', topicId: 'a', levelId: 'A2', text: 'third' },
  ],
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

function render(extra: readonly unknown[] = []) {
  const recognizer = fakeRecognizer();
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      ...signedOutBackend(),
      ...extra,
      {
        provide: SafeStorage,
        useValue: storedProfile() as unknown as SafeStorage,
      },
      { provide: CATALOG, useValue: DATA },
      { provide: RANDOM, useValue: NO_SHUFFLE },
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

function renderCustom(rawLines: readonly string[]) {
  const fake = {
    text: () => rawLines.join(' '),
    lines: () => rawLines,
    hasText: () => rawLines.length > 0,
    setText: () => {},
    clear: () => {},
  } as unknown as CustomTopicStore;

  const rendered = render([{ provide: CustomTopicStore, useValue: fake }]);
  rendered.practice.useCustomText();
  rendered.fixture.detectChanges();
  return rendered;
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
    practice.toggleTopic('a');
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

describe('LineList follows the current line', () => {
  it('scrolls the current line into view when the index moves', async () => {
    const { fixture, lines, practice } = render();
    const calls: Array<ScrollIntoViewOptions | boolean | undefined> = [];
    for (const p of lines.querySelectorAll('p')) {
      (p as HTMLElement).scrollIntoView = (opts?: ScrollIntoViewOptions | boolean) => {
        calls.push(opts);
      };
    }

    practice.goTo(2);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(calls.length).toBeGreaterThan(0);
    expect(calls.at(-1)).toEqual({ block: 'center', behavior: 'smooth' });
  });

  it('reveals the line that is current, not some other row', async () => {
    const { fixture, lines, practice } = render();
    const scrolled: string[] = [];
    for (const p of lines.querySelectorAll('p')) {
      const el = p as HTMLElement;
      el.scrollIntoView = () => {
        scrolled.push(el.querySelector('.num')?.textContent ?? '');
      };
    }

    practice.goTo(1);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(scrolled.at(-1)).toBe('2');
  });
});

describe('LineList renders custom text as text, never as markup', () => {
  it('shows tags literally instead of interpreting them', () => {
    const { lines } = renderCustom(['<b>bold</b> attempt.']);
    const text = lines.querySelector('p .text')!;
    expect(text.querySelector('b')).toBeNull();
    expect(text.textContent).toBe('<b>bold</b> attempt.');
  });

  it('does not build an element from an image payload', () => {
    const { lines } = renderCustom(['<img src=x onerror=alert(1)>Hi.']);
    expect(lines.querySelector('img')).toBeNull();
    expect(lines.querySelector('p .text')?.textContent).toBe('<img src=x onerror=alert(1)>Hi.');
  });

  it('does not build an element from a script payload', () => {
    const { lines } = renderCustom(['<script>alert(1)</script>Hi.']);
    expect(lines.querySelector('script')).toBeNull();
    expect(lines.querySelector('p .text')?.textContent).toBe('<script>alert(1)</script>Hi.');
  });

  it('keeps ampersands and angle brackets exactly as typed', () => {
    const { lines } = renderCustom(['R&D: a < b & c > d.']);
    expect(lines.querySelector('p .text')?.textContent).toBe('R&D: a < b & c > d.');
  });

  it('still numbers and selects custom lines like any other deck', () => {
    const { fixture, lines, practice } = renderCustom(['One.', 'Two.', 'Three.']);
    expect([...lines.querySelectorAll('p .num')].map((n) => n.textContent))
      .toEqual(['1', '2', '3']);

    lines.querySelectorAll<HTMLElement>('p')[2].click();
    fixture.detectChanges();
    expect(practice.index()).toBe(2);
  });
});

describe('LineList still trusts the built-in corpus', () => {
  it('renders chunk markup for corpus decks', () => {
    const { lines } = render();
    expect(lines.querySelectorAll('p .text')[1].querySelector('b')?.textContent)
      .toBe('a chunk');
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
