import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { MicrophoneService } from '../platform/microphone';
import { RANDOM } from '../platform/rng';
import { SpeechRecognizer } from '../platform/speech-recognition';
import { SafeStorage } from '../platform/storage';
import { CATALOG } from '../state/catalog-token';
import { SettingsStore } from '../state/settings-store';
import { NO_SHUFFLE, signedOutBackend, storedProfile, TEST_CATALOG } from '../testing/catalog';
import { CheckModeControl } from './check-mode';

@Component({
  imports: [CheckModeControl],
  template: `<div appCheckMode></div>`,
})
class Host {}

function render(opts: { stt?: boolean; micDenied?: boolean } = {}) {
  const release = vi.fn();
  const ensure = opts.micDenied
    ? vi.fn(() => Promise.reject(new Error('denied')))
    : vi.fn(() => Promise.resolve({}));

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      ...signedOutBackend(),
      {
        provide: SafeStorage,
        useValue: storedProfile() as unknown as SafeStorage,
      },
      { provide: CATALOG, useValue: TEST_CATALOG },
      { provide: RANDOM, useValue: NO_SHUFFLE },
      {
        provide: SpeechRecognizer,
        useValue: { supported: () => opts.stt !== false } as unknown as SpeechRecognizer,
      },
      {
        provide: MicrophoneService,
        useValue: {
          denied: () => opts.micDenied === true,
          ensure,
          markDenied() {},
          release,
        } as unknown as MicrophoneService,
      },
    ],
  });

  const fixture = TestBed.createComponent(Host);
  fixture.detectChanges();
  const root = (fixture.nativeElement as HTMLElement).querySelector('.check-mode')!;
  return {
    fixture,
    settings: TestBed.inject(SettingsStore),
    release,
    btn: (id: string) => root.querySelector<HTMLButtonElement>(`#check-${id}`)!,
    pressed: () => [...root.querySelectorAll<HTMLButtonElement>('button')]
      .filter((b) => b.getAttribute('aria-pressed') === 'true')
      .map((b) => b.id.replace('check-', '')),
  };
}

describe('CheckModeControl', () => {
  it('offers exactly one of nothing, speaking and spelling', () => {
    const { btn, pressed } = render();
    expect(btn('nothing').textContent?.trim()).toBe('Nothing');
    expect(btn('speaking').textContent?.trim()).toBe('Speaking');
    expect(btn('spelling').textContent?.trim()).toBe('Spelling');
    expect(pressed()).toEqual(['nothing']);
  });

  it('speaking turns scoring on and leaves typing off', async () => {
    const { fixture, settings, btn, pressed } = render();

    btn('speaking').click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(settings.sttEnabled()).toBe(true);
    expect(settings.typingMode()).toBe(false);
    expect(pressed()).toEqual(['speaking']);
  });

  it('spelling turns scoring on, switches to typing and frees the microphone', async () => {
    const { fixture, settings, btn, pressed, release } = render();

    btn('spelling').click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(settings.sttEnabled()).toBe(true);
    expect(settings.typingMode()).toBe(true);
    expect(release).toHaveBeenCalled();
    expect(pressed()).toEqual(['spelling']);
  });

  it('never asks for the microphone when spelling is chosen', async () => {
    const { fixture, btn } = render();
    const mic = TestBed.inject(MicrophoneService);

    btn('spelling').click();
    await fixture.whenStable();

    expect(mic.ensure).not.toHaveBeenCalled();
  });

  it('nothing turns scoring back off', async () => {
    const { fixture, settings, btn, pressed } = render();

    btn('speaking').click();
    await fixture.whenStable();
    fixture.detectChanges();

    btn('nothing').click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(settings.sttEnabled()).toBe(false);
    expect(pressed()).toEqual(['nothing']);
  });

  it('switches straight from speaking to spelling', async () => {
    const { fixture, settings, btn, pressed } = render();

    btn('speaking').click();
    await fixture.whenStable();
    fixture.detectChanges();
    btn('spelling').click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(settings.sttEnabled()).toBe(true);
    expect(settings.typingMode()).toBe(true);
    expect(pressed()).toEqual(['spelling']);
  });

  it('falls back to nothing when the microphone is refused', async () => {
    const { fixture, settings, btn, pressed } = render({ micDenied: true });

    btn('speaking').click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(settings.sttEnabled()).toBe(false);
    expect(pressed()).toEqual(['nothing']);
  });

  it('disables speaking where the browser cannot transcribe, but not spelling', () => {
    const { btn } = render({ stt: false });
    expect(btn('speaking').disabled).toBe(true);
    expect(btn('speaking').title).toMatch(/cannot transcribe/i);
    expect(btn('spelling').disabled).toBe(false);
  });
});
