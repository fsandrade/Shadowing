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
