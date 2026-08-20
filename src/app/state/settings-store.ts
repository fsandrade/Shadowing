import { effect, inject, Injectable, signal } from '@angular/core';
import { SafeStorage } from '../platform/storage';

export const SETTINGS_KEY = 'shadowing.settings';

export type PracticeSource = 'catalog' | 'custom';

interface StoredSettings {
  levelId?: unknown;
  topicId?: unknown;
  source?: unknown;
  rate?: unknown;
  slack?: unknown;
  voiceName?: unknown;
  durationMin?: unknown;
  blur?: unknown;
  stt?: unknown;
  repeat?: unknown;
  typing?: unknown;
}

function storedString(value: unknown): string | null {
  return typeof value === 'string' && value ? value : null;
}

@Injectable({ providedIn: 'root' })
export class SettingsStore {
  private readonly storage = inject(SafeStorage);

  private readonly saved = this.storage.read<StoredSettings>(SETTINGS_KEY) ?? {};

  readonly levelId = signal<string | null>(storedString(this.saved.levelId));

  readonly topicId = signal<string | null>(storedString(this.saved.topicId));

  readonly source = signal<PracticeSource>(
    this.saved.source === 'custom' ? 'custom' : 'catalog',
  );

  readonly rate = signal(Number(this.saved.rate) || 1);
  readonly slack = signal(Number(this.saved.slack) || 1);
  readonly voiceName = signal(
    typeof this.saved.voiceName === 'string' ? this.saved.voiceName : '',
  );
  readonly durationMin = signal(Number(this.saved.durationMin) || 0);
  readonly blur = signal(this.saved.blur === true);
  readonly sttEnabled = signal(this.saved.stt === true);
  readonly repeatUntilFive = signal(this.saved.repeat === true);
  readonly typingMode = signal(this.saved.typing === true);

  constructor() {
    effect(() => {
      this.storage.write(SETTINGS_KEY, {
        levelId: this.levelId(),
        topicId: this.topicId(),
        source: this.source(),
        rate: this.rate(),
        slack: this.slack(),
        voiceName: this.voiceName(),
        durationMin: this.durationMin(),
        blur: this.blur(),
        stt: this.sttEnabled(),
        repeat: this.repeatUntilFive(),
        typing: this.typingMode(),
      });
    });
  }

  setLevelId(id: string | null): void {
    this.levelId.set(id);
    this.topicId.set(null);
  }

  setTopicId(id: string | null): void { this.topicId.set(id); }
  setSource(source: PracticeSource): void { this.source.set(source); }
  setRate(v: number): void { this.rate.set(v); }
  setSlack(v: number): void { this.slack.set(v); }
  setVoiceName(name: string): void { this.voiceName.set(name); }
  setDurationMin(min: number): void { this.durationMin.set(min); }
  setBlur(on: boolean): void { this.blur.set(on); }
  setSttEnabled(on: boolean): void { this.sttEnabled.set(on); }
  setRepeatUntilFive(on: boolean): void { this.repeatUntilFive.set(on); }
  setTypingMode(on: boolean): void { this.typingMode.set(on); }
}
