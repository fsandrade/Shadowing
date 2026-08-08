import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { MicrophoneService } from '../platform/microphone';
import { SpeechRecognizer } from '../platform/speech-recognition';
import { SafeStorage } from '../platform/storage';
import { ValidationService } from '../validation/validation-service';
import { ValidateBox } from './validate-box';

/** Rendered through real markup so the host stays a <div class="validate-box">. */
@Component({
  imports: [ValidateBox],
  template: `<div appValidateBox></div>`,
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
      {
        provide: SpeechRecognizer,
        useValue: {
          supported: () => true,
          recognize: () => ({ start() {}, stop() {}, abort() {} }),
        } as unknown as SpeechRecognizer,
      },
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
    box: (fixture.nativeElement as HTMLElement).querySelector('.validate-box')!,
    validation: TestBed.inject(ValidationService),
  };
}

describe('ValidateBox', () => {
  it('renders as <div class="validate-box"> with the three slots', () => {
    const { box } = render();
    expect(box.classList.contains('validate-box')).toBe(true);
    expect(box.querySelector('.mic-dot')).not.toBeNull();
    expect(box.querySelector('.transcript')).not.toBeNull();
    expect(box.querySelector('.stars')).not.toBeNull();
  });

  it('shows the live transcript', () => {
    const { fixture, box, validation } = render();
    validation.begin(0, 'hit the road');
    fixture.detectChanges();
    expect(box.querySelector('.transcript')?.textContent).toContain('Listening');
  });

  it('renders filled and empty stars for a rating', () => {
    const { fixture, box, validation } = render();
    validation.stars.set(3);
    fixture.detectChanges();
    expect(box.querySelector('.stars')?.textContent).toBe('★★★☆☆');
  });

  it('renders no stars when there is no rating', () => {
    const { box } = render();
    expect(box.querySelector('.stars')?.textContent).toBe('');
  });

  it('renders five filled stars for a perfect repeat', () => {
    const { fixture, box, validation } = render();
    validation.stars.set(5);
    fixture.detectChanges();
    expect(box.querySelector('.stars')?.textContent).toBe('★★★★★');
  });

  it('renders five empty stars for a zero rating', () => {
    const { fixture, box, validation } = render();
    validation.stars.set(0);
    fixture.detectChanges();
    expect(box.querySelector('.stars')?.textContent).toBe('☆☆☆☆☆');
  });
});
