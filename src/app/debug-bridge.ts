import { inject, Injectable } from '@angular/core';
import { PlaybackService } from './playback/playback-service';
import { PracticeStore } from './state/practice-store';
import { SettingsStore } from './state/settings-store';

/**
 * Publishes `window.__shadowing.state` in the shape the Playwright suite reads,
 * so the specs need no rewrite. Getters, not a snapshot, so reads are always
 * current. This is a test seam, kept deliberately minimal.
 */
@Injectable({ providedIn: 'root' })
export class DebugBridge {
  private readonly practice = inject(PracticeStore);
  private readonly settings = inject(SettingsStore);
  private readonly playback = inject(PlaybackService);

  install(): void {
    if (typeof window === 'undefined') { return; }
    const { practice, settings, playback } = this;

    (window as unknown as Record<string, unknown>)['__shadowing'] = {
      state: {
        get index() { return practice.index(); },
        get playing() { return practice.playing(); },
        get lines() { return practice.lines(); },
        get deckId() { return settings.deckId(); },
        get blur() { return settings.blur(); },
        get sttEnabled() { return settings.sttEnabled(); },
        get progress() { return playback.progress(); },
      },
    };
  }
}
