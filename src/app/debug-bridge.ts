import { inject, Injectable } from '@angular/core';
import { PlaybackService } from './playback/playback-service';
import { PracticeStore } from './state/practice-store';
import { SettingsStore } from './state/settings-store';

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
        get levelId() { return settings.levelId(); },
        get topicId() { return settings.topicId(); },
        get source() { return settings.source(); },
        get blur() { return settings.blur(); },
        get sttEnabled() { return settings.sttEnabled(); },
        get progress() { return playback.progress(); },
      },
    };
  }
}
