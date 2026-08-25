import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { type LineResult } from '../validation/validation-service';
import { ValidateBox } from './validate-box';

@Component({
  imports: [ValidateBox],
  template: `<div appValidateBox [result]="result()"></div>`,
})
class Host {
  readonly result = signal<LineResult>({
    transcript: '',
    stars: null,
    status: 'listening',
  });
}

function render(result: LineResult) {
  TestBed.resetTestingModule();
  const fixture = TestBed.createComponent(Host);
  fixture.componentInstance.result.set(result);
  fixture.detectChanges();
  return {
    fixture,
    host: fixture.componentInstance,
    box: (fixture.nativeElement as HTMLElement).querySelector('.validate-box')!,
  };
}

const listening: LineResult = { transcript: 'Listening…', stars: null, status: 'listening' };
const scored: LineResult = { transcript: 'hit the road', stars: 5, status: 'scored' };
const failed: LineResult = { transcript: 'No speech detected', stars: null, status: 'failed' };

describe('ValidateBox', () => {
  it('renders as <div class="validate-box"> with the three slots', () => {
    const { box } = render(listening);
    expect(box.classList.contains('validate-box')).toBe(true);
    expect(box.querySelector('.mic-dot')).not.toBeNull();
    expect(box.querySelector('.transcript')).not.toBeNull();
    expect(box.querySelector('.stars')).not.toBeNull();
  });

  it('shows the transcript it was given', () => {
    expect(render(scored).box.querySelector('.transcript')?.textContent)
      .toBe('hit the road');
  });

  it('renders filled and empty stars for a rating', () => {
    expect(render({ ...scored, stars: 3 }).box.querySelector('.stars')?.textContent)
      .toBe('★★★☆☆');
  });

  it('renders no stars when there is no rating', () => {
    expect(render(failed).box.querySelector('.stars')?.textContent).toBe('');
  });

  it('renders five filled stars for a perfect repeat', () => {
    expect(render({ ...scored, stars: 5 }).box.querySelector('.stars')?.textContent)
      .toBe('★★★★★');
  });

  it('renders five empty stars for a zero rating', () => {
    expect(render({ ...scored, stars: 0 }).box.querySelector('.stars')?.textContent)
      .toBe('☆☆☆☆☆');
  });
});

describe('ValidateBox status', () => {
  it('carries exactly one status class at a time', () => {
    const { fixture, host, box } = render(listening);
    expect([...box.classList]).toContain('listening');
    expect([...box.classList]).not.toContain('scored');
    expect([...box.classList]).not.toContain('failed');

    host.result.set(scored);
    fixture.detectChanges();
    expect([...box.classList]).toContain('scored');
    expect([...box.classList]).not.toContain('listening');

    host.result.set(failed);
    fixture.detectChanges();
    expect([...box.classList]).toContain('failed');
    expect([...box.classList]).not.toContain('scored');
  });
});

describe('ValidateBox independence', () => {
  it('shows independent content per instance', () => {
    TestBed.resetTestingModule();

    @Component({
      imports: [ValidateBox],
      template: `
        <div appValidateBox
          [result]="{ transcript: 'first', stars: 5, status: 'scored' }"></div>
        <div appValidateBox
          [result]="{ transcript: 'second', stars: 2, status: 'scored' }"></div>
      `,
    })
    class TwoBoxes {}

    const fixture = TestBed.createComponent(TwoBoxes);
    fixture.detectChanges();
    const boxes = [...(fixture.nativeElement as HTMLElement)
      .querySelectorAll('.validate-box')];

    expect(boxes.map((b) => b.querySelector('.transcript')?.textContent))
      .toEqual(['first', 'second']);
    expect(boxes.map((b) => b.querySelector('.stars')?.textContent))
      .toEqual(['★★★★★', '★★☆☆☆']);
  });
});

describe('ValidateBox typing', () => {
  @Component({
    imports: [ValidateBox],
    template: `<div appValidateBox [result]="result()"
      (answered)="submitted.push($event)" (replay)="replays = replays + 1"></div>`,
  })
  class TypingHost {
    readonly result = signal<LineResult>({
      transcript: 'Type the sentence, then press Enter',
      stars: null,
      status: 'typing',
    });

    readonly submitted: string[] = [];
    replays = 0;
  }

  function renderTyping() {
    TestBed.resetTestingModule();
    const fixture = TestBed.createComponent(TypingHost);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    return {
      fixture,
      host: fixture.componentInstance,
      box: root.querySelector('.validate-box')!,
      field: () => root.querySelector('input'),
    };
  }

  it('offers a text field instead of a transcript', () => {
    const { box, field } = renderTyping();
    expect(field()).not.toBeNull();
    expect(box.classList.contains('typing')).toBe(true);
    expect(box.querySelector('.stars')).toBeNull();
  });

  it('uses the prompt as the placeholder', () => {
    expect(renderTyping().field()?.placeholder).toBe('Type the sentence, then press Enter');
  });

  it('emits what was typed when Enter is pressed', () => {
    const { host, field } = renderTyping();
    const input = field()!;
    input.value = 'hit the road';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    expect(host.submitted).toEqual(['hit the road']);
  });

  it('does not emit on other keys', () => {
    const { host, field } = renderTyping();
    const input = field()!;
    input.value = 'partial';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));

    expect(host.submitted).toEqual([]);
  });

  it('turns off spellcheck and autocapitalise, so the keyboard cannot help', () => {
    const input = renderTyping().field()!;
    expect(input.getAttribute('spellcheck')).toBe('false');
    expect(input.getAttribute('autocapitalize')).toBe('off');
    expect(input.getAttribute('autocomplete')).toBe('off');
  });

  it('swaps the field for the marked words once scored', () => {
    const { fixture, host, box, field } = renderTyping();
    host.result.set({
      transcript: 'a quik clarification',
      stars: 3,
      status: 'scored',
      words: [
        { text: 'a', ok: true },
        { text: 'quik', ok: false },
        { text: 'clarification', ok: true },
      ],
    });
    fixture.detectChanges();

    expect(field()).toBeNull();
    expect([...box.querySelectorAll('.transcript .wrong')].map((w) => w.textContent))
      .toEqual(['quik']);
    expect(box.querySelector('.transcript')?.textContent?.trim())
      .toBe('a quik clarification');
    expect(box.querySelector('.stars')?.textContent).toBe('★★★☆☆');
  });

  it('names the words that were left out', () => {
    const { fixture, host, box } = renderTyping();
    host.result.set({
      transcript: 'let me jump in with quick note',
      stars: 4,
      status: 'scored',
      words: [{ text: 'let', ok: true }],
      missed: ['a'],
    });
    fixture.detectChanges();

    expect(box.querySelector('.missed')?.textContent).toBe('missed: a');
  });

  it('shows no missed note when nothing was left out', () => {
    const { fixture, host, box } = renderTyping();
    host.result.set({
      transcript: 'hit the road',
      stars: 5,
      status: 'scored',
      words: [{ text: 'hit', ok: true }],
      missed: [],
    });
    fixture.detectChanges();

    expect(box.querySelector('.missed')).toBeNull();
  });
});

describe('ValidateBox replaying the audio while typing', () => {
  @Component({
    imports: [ValidateBox],
    template: `<div appValidateBox [result]="result()"
      (answered)="submitted.push($event)" (replay)="replays = replays + 1"></div>`,
  })
  class ReplayHost {
    readonly result = signal<LineResult>({
      transcript: 'Type the sentence, then press Enter',
      stars: null,
      status: 'typing',
    });

    readonly submitted: string[] = [];
    replays = 0;
  }

  function renderTyping() {
    TestBed.resetTestingModule();
    const fixture = TestBed.createComponent(ReplayHost);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    return {
      fixture,
      host: fixture.componentInstance,
      field: () => root.querySelector('input')!,
    };
  }

  function arrowUp(): KeyboardEvent {
    return new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true });
  }

  it('asks for the audio again when the up arrow is pressed', () => {
    const { fixture, host, field } = renderTyping();

    field().dispatchEvent(arrowUp());
    fixture.detectChanges();

    expect(host.replays).toBe(1);
  });

  it('stops the browser jumping the caret to the start of the field', () => {
    // Up arrow in a single-line input moves the caret to position 0. Without
    // preventDefault the next keystroke would land in the wrong place, which
    // is worse than having no shortcut at all.
    const { field } = renderTyping();
    const event = arrowUp();

    field().dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
  });

  it('does not submit the answer', () => {
    const { fixture, host, field } = renderTyping();

    field().value = 'half a sentence';
    field().dispatchEvent(arrowUp());
    fixture.detectChanges();

    expect(host.submitted).toEqual([]);
    expect(field().value).toBe('half a sentence');
  });

  it('says nothing about replaying when there is no field to type in', () => {
    const { fixture, host } = renderTyping();
    fixture.componentInstance.result.set({
      transcript: 'hit the road', stars: 5, status: 'scored',
    });
    fixture.detectChanges();

    document.dispatchEvent(arrowUp());
    fixture.detectChanges();

    expect(host.replays).toBe(0);
  });
});
