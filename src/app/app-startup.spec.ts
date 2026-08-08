import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppStartup } from './app-startup';
import { type Corpus, CUSTOM_DECK_ID } from './core/deck';
import { MicrophoneService } from './platform/microphone';
import { Speaker } from './platform/speaker';
import { SafeStorage } from './platform/storage';
import { CORPUS_DATA } from './state/corpus-token';
import { SETTINGS_KEY, SettingsStore } from './state/settings-store';

const DATA: Corpus = {
  generatedAt: '2026-08-06T00:00:00Z',
  decks: [{ id: 'a', name: 'A', lines: ['a1', 'a2'] }],
};

function setup(storedDeckId: string) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: CORPUS_DATA, useValue: DATA },
      {
        provide: SafeStorage,
        useValue: {
          read: (key: string) => (key === SETTINGS_KEY ? { deckId: storedDeckId } : null),
          write: () => {},
        } as unknown as SafeStorage,
      },
      {
        provide: Speaker,
        useValue: {
          supported: true,
          voices: () => [{ name: 'David', lang: 'en-US' }] as SpeechSynthesisVoice[],
          onVoicesChanged: () => {},
          speak: () => Promise.resolve(),
          cancel: () => {},
          keepAlive: () => {},
        } as unknown as Speaker,
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
  const startup = TestBed.inject(AppStartup);
  TestBed.runInInjectionContext(() => startup.run());
  return { settings: TestBed.inject(SettingsStore) };
}

describe('AppStartup deck recovery', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('keeps a deck that still exists in the corpus', () => {
    expect(setup('a').settings.deckId()).toBe('a');
  });

  it('falls back to All when the stored deck is gone', () => {
    expect(setup('deck-that-was-removed').settings.deckId()).toBe('all');
  });

  it('keeps the custom topic even though it has no corpus lines', () => {
    expect(setup(CUSTOM_DECK_ID).settings.deckId()).toBe(CUSTOM_DECK_ID);
  });
});
