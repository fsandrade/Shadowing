import { inject, Injectable } from '@angular/core';
import { PlaybackService } from './playback/playback-service';
import { PracticeStore } from './state/practice-store';
import { ProfileStore } from './state/profile-store';
import { SettingsStore } from './state/settings-store';

@Injectable({ providedIn: 'root' })
export class DebugBridge {
  private readonly practice = inject(PracticeStore);
  private readonly profile = inject(ProfileStore);
  private readonly settings = inject(SettingsStore);
  private readonly playback = inject(PlaybackService);

  install(): void {
    if (typeof window === 'undefined') { return; }
    const { practice, profile, settings, playback } = this;

    (window as unknown as Record<string, unknown>)['__shadowing'] = {
      state: {
        get index() { return practice.index(); },
        get playing() { return practice.playing(); },
        get lines() { return practice.lines(); },
        get levelId() { return profile.levelId(); },
        get topicId() { return settings.topicId(); },
        get source() { return settings.source(); },
        get blur() { return settings.blur(); },
        get sttEnabled() { return settings.sttEnabled(); },
        get progress() { return playback.progress(); },
      },
    };
  }
}
