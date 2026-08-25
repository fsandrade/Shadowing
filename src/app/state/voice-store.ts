import { computed, inject, Injectable, signal } from '@angular/core';
import { hasEnglishVoice, isEnglish, pickVoice } from '../core/voice';
import { Speaker } from '../platform/speaker';
import { SettingsStore } from './settings-store';

@Injectable({ providedIn: 'root' })
export class VoiceStore {
  private readonly speaker = inject(Speaker);
  private readonly settings = inject(SettingsStore);

  readonly voices = signal<readonly SpeechSynthesisVoice[]>([]);

  readonly englishVoices = computed(() => this.voices().filter(isEnglish));

  readonly selected = computed(() =>
    pickVoice(this.voices(), this.settings.voiceName()),
  );

  readonly hasEnglish = computed(() => hasEnglishVoice(this.voices()));

  constructor() {
    this.speaker.onVoicesChanged(() => this.refresh());
  }

  refresh(): void {
    const next = this.speaker.voices();
    if (!next.length) { return; }
    this.voices.set(next);
  }
}
