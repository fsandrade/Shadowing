import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { type Corpus } from '../core/deck';
import { PlaybackService } from '../playback/playback-service';
import { SPEECH_RECOGNITION_CTOR } from '../platform/speech-recognition';
import { Speaker } from '../platform/speaker';
import { SafeStorage } from '../platform/storage';
import { CORPUS_DATA } from '../state/corpus-token';
import { PracticeStore } from '../state/practice-store';
import { SettingsStore } from '../state/settings-store';
import { VoiceStore } from '../state/voice-store';
import { TransportControls } from './transport-controls';

const DATA: Corpus = {
  generatedAt: '2026-08-06T00:00:00Z',
  decks: [{ id: 'a', name: 'A', lines: ['one', 'two'] }],
};

@Component({
  imports: [TransportControls],
  template: `<div appTransportControls
    [optionsOpen]="optionsOpen()"
    (toggleOptions)="toggled = toggled + 1"></div>`,
})
class Host {
  readonly optionsOpen = signal(false);
  toggled = 0;
}

function render(opts: { voices?: SpeechSynthesisVoice[]; stt?: boolean } = {}) {
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
      {
        provide: SPEECH_RECOGNITION_CTOR,
        useValue: opts.stt === false ? null : (class {} as never),
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
    transport: root.querySelector('.transport')!,
    practice: TestBed.inject(PracticeStore),
    settings: TestBed.inject(SettingsStore),
    playback: TestBed.inject(PlaybackService),
    btn: (id: string) => root.querySelector(`#${id}`) as HTMLButtonElement,
  };
}

describe('TransportControls structure', () => {
  it('renders as <div class="transport"> with just the core controls', () => {
    const { transport } = render();
    expect(transport.classList.contains('transport')).toBe(true);
    expect([...transport.querySelectorAll('button')].map((b) => b.id))
      .toEqual(['play', 'next', 'validate', 'options']);
  });

  it('keeps the vanilla titles the specs and tooltips rely on', () => {
    const { btn } = render();
    expect(btn('play').title).toMatch(/Play\/Pause \(space\)/);
    expect(btn('next').title).toBe('Next (→)');
    expect(btn('validate').title).toMatch(/Speech validator/);
  });
});

describe('TransportControls play label', () => {
  it('reads Play when idle and Pause while playing', () => {
    const { fixture, btn, practice } = render();
    expect(btn('play').textContent).toContain('Play');

    practice.setPlaying(true);
    fixture.detectChanges();
    expect(btn('play').textContent).toContain('Pause');
  });
});

describe('TransportControls disabled state', () => {
  it('disables play and next when no English voice exists', () => {
    const { btn } = render({
      voices: [{ name: 'Maria', lang: 'pt-BR' }] as SpeechSynthesisVoice[],
    });
    expect(btn('play').disabled).toBe(true);
    expect(btn('next').disabled).toBe(true);
  });

  it('disables play and next when the deck is empty', () => {
    const { fixture, btn, practice } = render();
    practice.selectDeck('missing');
    fixture.detectChanges();
    expect(btn('play').disabled).toBe(true);
  });

  it('enables them with an English voice and a non-empty deck', () => {
    const { btn } = render();
    expect(btn('play').disabled).toBe(false);
    expect(btn('next').disabled).toBe(false);
  });

  it('disables validate when speech recognition is unavailable', () => {
    expect(render({ stt: false }).btn('validate').disabled).toBe(true);
  });
});

describe('TransportControls toggles', () => {
  it('play delegates to PlaybackService.toggle', () => {
    const { btn, playback } = render();
    const toggle = vi.spyOn(playback, 'toggle');
    btn('play').click();
    expect(toggle).toHaveBeenCalledOnce();
  });

  it('next delegates to PlaybackService', () => {
    const { btn, playback } = render();
    const next = vi.spyOn(playback, 'next');
    btn('next').click();
    expect(next).toHaveBeenCalledOnce();
  });

  it('the options button reports and toggles the panel', () => {
    const { fixture, host, btn } = render();
    expect(btn('options').getAttribute('aria-expanded')).toBe('false');
    expect(btn('options').getAttribute('aria-controls')).toBe('optionsPanel');

    btn('options').click();
    fixture.detectChanges();
    expect(host.toggled).toBe(1);
  });
});
