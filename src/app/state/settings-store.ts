import { effect, inject, Injectable, signal } from '@angular/core';
import { ALL_DECK_ID } from '../core/deck';
import { SafeStorage } from '../platform/storage';

export const SETTINGS_KEY = 'shadowing.settings';

interface StoredSettings {
  deckId?: unknown;
  rate?: unknown;
  slack?: unknown;
  voiceName?: unknown;
  durationMin?: unknown;
  blur?: unknown;
  stt?: unknown;
}

@Injectable({ providedIn: 'root' })
export class SettingsStore {
  private readonly storage = inject(SafeStorage);

  private readonly saved = this.storage.read<StoredSettings>(SETTINGS_KEY) ?? {};

  readonly deckId = signal<string>(
    typeof this.saved.deckId === 'string' && this.saved.deckId
      ? this.saved.deckId
      : ALL_DECK_ID,
  );

  readonly rate = signal(Number(this.saved.rate) || 1);
  readonly slack = signal(Number(this.saved.slack) || 1);
  readonly voiceName = signal(
    typeof this.saved.voiceName === 'string' ? this.saved.voiceName : '',
  );
  readonly durationMin = signal(Number(this.saved.durationMin) || 0);
  readonly blur = signal(this.saved.blur === true);
  readonly sttEnabled = signal(this.saved.stt === true);

  constructor() {
    effect(() => {
      this.storage.write(SETTINGS_KEY, {
        deckId: this.deckId(),
        rate: this.rate(),
        slack: this.slack(),
        voiceName: this.voiceName(),
        durationMin: this.durationMin(),
        blur: this.blur(),
        stt: this.sttEnabled(),
      });
    });
  }

  setDeckId(id: string): void { this.deckId.set(id); }
  setRate(v: number): void { this.rate.set(v); }
  setSlack(v: number): void { this.slack.set(v); }
  setVoiceName(name: string): void { this.voiceName.set(name); }
  setDurationMin(min: number): void { this.durationMin.set(min); }
  setBlur(on: boolean): void { this.blur.set(on); }
  setSttEnabled(on: boolean): void { this.sttEnabled.set(on); }
}
