import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { type Corpus } from '../core/deck';
import { PlaybackService } from '../playback/playback-service';
import { Speaker } from '../platform/speaker';
import { SafeStorage } from '../platform/storage';
import { CORPUS_DATA } from '../state/corpus-token';
import { SettingsStore } from '../state/settings-store';
import { VoiceStore } from '../state/voice-store';
import { OptionsPanel } from './options-panel';

const DATA: Corpus = {
  generatedAt: '2026-08-06T00:00:00Z',
  decks: [{ id: 'a', name: 'A', lines: ['one', 'two'] }],
};

@Component({
  imports: [OptionsPanel],
  template: `<div appOptionsPanel [open]="open()"></div>`,
})
class Host {
  readonly open = signal(false);
}

function render(opts: { voices?: SpeechSynthesisVoice[] } = {}) {
  const voices = opts.voices
    ?? ([{ name: 'David', lang: 'en-US' }] as SpeechSynthesisVoice[]);
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
          voices: () => voices,
          onVoicesChanged: () => {},
          speak: vi.fn().mockResolvedValue(undefined),
          cancel: vi.fn(),
          keepAlive: vi.fn(),
        } as unknown as Speaker,
      },
    ],
  });
  TestBed.inject(VoiceStore).refresh();
  const fixture = TestBed.createComponent(Host);
  fixture.detectChanges();
  const root = fixture.nativeElement as HTMLElement;
  return {
    fixture,
    host: fixture.componentInstance,
    panel: root.querySelector('.options')!,
    settings: TestBed.inject(SettingsStore),
    playback: TestBed.inject(PlaybackService),
    btn: (id: string) => root.querySelector(`#${id}`) as HTMLButtonElement,
  };
}

describe('OptionsPanel visibility', () => {
  it('stays collapsed until it is opened', () => {
    const { fixture, host, panel } = render();
    expect(panel.classList.contains('show')).toBe(false);

    host.open.set(true);
    fixture.detectChanges();
    expect(panel.classList.contains('show')).toBe(true);
  });

  it('keeps its controls in the DOM while collapsed, so their state survives', () => {
    const { panel } = render();
    expect(panel.querySelector('#shuffle')).not.toBeNull();
    expect(panel.querySelector('#blur')).not.toBeNull();
    expect(panel.querySelector('#repeat')).not.toBeNull();
    expect(panel.querySelector('.sliders')).not.toBeNull();
  });
});

describe('OptionsPanel contents', () => {
  it('holds the advanced controls that used to sit in the transport bar', () => {
    const { panel } = render();
    expect([...panel.querySelectorAll('.options-actions button')].map((b) => b.id))
      .toEqual(['shuffle', 'blur', 'repeat']);
  });

  it('keeps the speed, gap and voice controls', () => {
    const { panel } = render();
    expect(panel.querySelector('#rate')).not.toBeNull();
    expect(panel.querySelector('#slack')).not.toBeNull();
    expect(panel.querySelector('#voice')).not.toBeNull();
  });

  it('disables shuffle when there is no audio to practise with', () => {
    const { btn } = render({
      voices: [{ name: 'Maria', lang: 'pt-BR' }] as SpeechSynthesisVoice[],
    });
    expect(btn('shuffle').disabled).toBe(true);
  });
});

describe('OptionsPanel blur', () => {
  it('reflects and updates the setting via aria-pressed', () => {
    const { fixture, btn, settings } = render();
    expect(btn('blur').getAttribute('aria-pressed')).toBe('false');

    btn('blur').click();
    fixture.detectChanges();
    expect(settings.blur()).toBe(true);
    expect(btn('blur').getAttribute('aria-pressed')).toBe('true');

    btn('blur').click();
    fixture.detectChanges();
    expect(settings.blur()).toBe(false);
  });
});

describe('OptionsPanel shuffle', () => {
  it('delegates to PlaybackService', () => {
    const { btn, playback } = render();
    const shuffle = vi.spyOn(playback, 'shuffle');
    btn('shuffle').click();
    expect(shuffle).toHaveBeenCalledOnce();
  });
});

describe('OptionsPanel repeat until 5', () => {
  it('is off by default and needs the validator', () => {
    const { btn, settings } = render();
    expect(settings.repeatUntilFive()).toBe(false);
    expect(btn('repeat').getAttribute('aria-pressed')).toBe('false');
    expect(btn('repeat').disabled).toBe(true);
  });

  it('becomes available once the validator is on', () => {
    const { fixture, btn, settings } = render();
    settings.setSttEnabled(true);
    fixture.detectChanges();
    expect(btn('repeat').disabled).toBe(false);
  });

  it('toggles the setting', () => {
    const { fixture, btn, settings } = render();
    settings.setSttEnabled(true);
    fixture.detectChanges();

    btn('repeat').click();
    fixture.detectChanges();
    expect(settings.repeatUntilFive()).toBe(true);
    expect(btn('repeat').getAttribute('aria-pressed')).toBe('true');

    btn('repeat').click();
    fixture.detectChanges();
    expect(settings.repeatUntilFive()).toBe(false);
  });

  it('explains that it depends on rate me', () => {
    expect(render().btn('repeat').title).toMatch(/rate me/i);
  });
});
