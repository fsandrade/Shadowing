import {
  afterEveryRender, afterRenderEffect, ChangeDetectionStrategy, Component, computed,
  effect, ElementRef, inject, signal, untracked, viewChild,
} from '@angular/core';
import { maskedWords } from '../core/typing';
import { PlaybackService } from '../playback/playback-service';
import { Speaker } from '../platform/speaker';
import { DictationStore } from '../state/dictation-store';
import { FlowStore } from '../state/flow-store';
import { PracticeStore } from '../state/practice-store';
import { SessionTimerStore } from '../state/session-timer-store';
import { SettingsStore } from '../state/settings-store';
import { VoiceStore } from '../state/voice-store';

@Component({
  selector: 'main[appDictation]',
  imports: [],
  host: { class: 'dictation' },
  templateUrl: './dictation.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Dictation {
  protected readonly store = inject(DictationStore);
  protected readonly practice = inject(PracticeStore);
  protected readonly timer = inject(SessionTimerStore);

  private readonly speaker = inject(Speaker);
  private readonly settings = inject(SettingsStore);
  private readonly voices = inject(VoiceStore);
  private readonly playback = inject(PlaybackService);
  private readonly flow = inject(FlowStore);

  protected readonly typed = signal('');
  protected readonly repeatUntilFive = this.settings.repeatUntilFive;

  protected readonly status = computed(() => this.store.status(this.store.index()));

  private readonly input = viewChild<ElementRef<HTMLInputElement>>('dictInput');
  private focusInput = false;
  private finished = false;

  constructor() {
    afterRenderEffect(() => {
      this.store.index();
      this.typed.set('');
      untracked(() => void this.playCurrent());
    });

    afterEveryRender(() => {
      if (!this.focusInput) { return; }
      this.focusInput = false;
      this.input()?.nativeElement.focus();
    });

    effect(() => {
      this.timer.clockText();
      untracked(() => this.checkExpiry());
    });
  }

  public checkExpiry(): void {
    if (this.timer.expired() && !this.finished) {
      this.finished = true;
      this.finish();
    }
  }

  protected masked(): readonly { text: string; ok: boolean }[] {
    const i = this.store.index();
    if (!this.store.revealed().has(i)) { return []; }
    return maskedWords(this.store.textAt(i), this.typed());
  }

  protected issue(): boolean { return this.status() !== 'todo'; }

  protected setShowImmediate(checked: boolean): void {
    this.store.showAnswerImmediately.set(checked);
    if (checked) { this.store.revealFull(); }
  }

  protected setShowFull(checked: boolean): void {
    this.store.showFull.set(checked);
    if (checked) { this.store.revealFull(); }
  }

  protected onReplay(): void { void this.playCurrent(); }

  protected check(): void { this.store.check(this.typed()); }

  protected toggleRepeat(): void {
    this.settings.setRepeatUntilFive(!this.settings.repeatUntilFive());
  }

  protected retry(): void {
    this.store.retry();
    this.typed.set('');
    this.focusInput = true;
  }

  protected finish(): void {
    this.playback.stop();
    this.flow.finish();
  }

  private async playCurrent(): Promise<void> {
    const i = this.store.index();
    const text = this.store.textAt(i);
    if (!text) { return; }
    await this.speakText(text);
  }

  private speakText(text: string): Promise<void> {
    return this.speaker.speak(text, { rate: this.settings.rate(), voice: this.voices.selected() });
  }
}
