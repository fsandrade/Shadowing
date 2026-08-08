import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { Speaker } from '../platform/speaker';
import { SafeStorage } from '../platform/storage';
import { SettingsStore } from './settings-store';
import { VoiceStore } from './voice-store';

const v = (name: string, lang: string) => ({ name, lang } as SpeechSynthesisVoice);

function setup(initial: SpeechSynthesisVoice[], storedVoiceName = '') {
  let voices = initial;
  const listeners: Array<() => void> = [];
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      {
        provide: SafeStorage,
        useValue: {
          read: () => ({ voiceName: storedVoiceName }),
          write: () => {},
        } as unknown as SafeStorage,
      },
      {
        provide: Speaker,
        useValue: {
          voices: () => voices,
          onVoicesChanged: (fn: () => void) => void listeners.push(fn),
        } as unknown as Speaker,
      },
    ],
  });
  return {
    store: TestBed.inject(VoiceStore),
    settings: TestBed.inject(SettingsStore),
    fireVoicesChanged: () => listeners.forEach((fn) => fn()),
    setVoices: (next: SpeechSynthesisVoice[]) => { voices = next; },
  };
}

describe('VoiceStore', () => {
  it('is empty until refreshed', () => {
    expect(setup([v('David', 'en-US')]).store.voices()).toEqual([]);
  });

  it('loads voices on refresh', () => {
    const { store } = setup([v('David', 'en-US')]);
    store.refresh();
    expect(store.voices().length).toBe(1);
  });

  it('ignores an empty voice list, since Chrome reports [] before it is ready', () => {
    const { store, setVoices } = setup([]);
    store.refresh();
    expect(store.voices()).toEqual([]);

    setVoices([v('David', 'en-US')]);
    store.refresh();
    expect(store.voices().length).toBe(1);
  });

  it('filters the picker list to English voices only', () => {
    const { store } = setup([v('Maria', 'pt-BR'), v('David', 'en-US'), v('Sonia', 'en-GB')]);
    store.refresh();
    expect(store.englishVoices().map((x) => x.name)).toEqual(['David', 'Sonia']);
  });

  it('selects the remembered voice when it is present', () => {
    const { store } = setup([v('Aria Natural', 'en-US'), v('David', 'en-US')], 'David');
    store.refresh();
    expect(store.selected()?.name).toBe('David');
  });

  it('prefers a Natural en-US voice with nothing remembered', () => {
    const { store } = setup([v('David', 'en-US'), v('Aria Natural', 'en-US')]);
    store.refresh();
    expect(store.selected()?.name).toBe('Aria Natural');
  });

  it('reports whether any English voice exists', () => {
    const withEn = setup([v('David', 'en-US')]);
    withEn.store.refresh();
    expect(withEn.store.hasEnglish()).toBe(true);

    const withoutEn = setup([v('Maria', 'pt-BR')]);
    withoutEn.store.refresh();
    expect(withoutEn.store.hasEnglish()).toBe(false);
  });

  it('refreshes when the platform fires voiceschanged', () => {
    const { store, setVoices, fireVoicesChanged } = setup([]);
    setVoices([v('David', 'en-US')]);
    fireVoicesChanged();
    expect(store.voices().length).toBe(1);
  });
});
