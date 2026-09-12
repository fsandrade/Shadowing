import {
  afterRenderEffect, ChangeDetectionStrategy, Component, computed, inject, signal, untracked,
} from '@angular/core';
import { maskedWords } from '../core/typing';
import { PlaybackService } from '../playback/playback-service';
import { Speaker } from '../platform/speaker';
import { YoutubePlayerService } from '../platform/youtube-player';
import { DictationStore } from '../state/dictation-store';
import { FlowStore } from '../state/flow-store';
import { PracticeStore } from '../state/practice-store';
import { SessionTimerStore } from '../state/session-timer-store';
import { SettingsStore } from '../state/settings-store';
import { VoiceStore } from '../state/voice-store';
import { YoutubePlayer } from './youtube-player';

@Component({
  selector: 'main[appDictation]',
  imports: [YoutubePlayer],
  host: { class: 'dictation' },
  templateUrl: './dictation.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Dictation {
  protected readonly store = inject(DictationStore);
  protected readonly practice = inject(PracticeStore);
  protected readonly timer = inject(SessionTimerStore);

  private readonly speaker = inject(Speaker);
  private readonly youtube = inject(YoutubePlayerService);
  private readonly settings = inject(SettingsStore);
  private readonly voices = inject(VoiceStore);
  private readonly playback = inject(PlaybackService);
  private readonly flow = inject(FlowStore);

  protected readonly typed = signal('');
  protected readonly playing = signal(false);

  protected readonly status = computed(() => this.store.status(this.store.index()));

  constructor() {
    afterRenderEffect(() => {
      this.store.index();
      // The input keeps its DOM value via [value]="typed()"; on a new
      // challenge the old answer must not survive to be scored against it.
      this.typed.set('');
      untracked(() => void this.playCurrent());
    });
  }

  protected masked(): readonly { text: string; ok: boolean }[] {
    const i = this.store.index();
    if (!this.store.revealed().has(i)) { return []; }
    return maskedWords(this.store.textAt(i), this.typed());
  }

  protected issue(): boolean { return this.status() !== 'todo'; }

  protected onReplay(): void { void this.playCurrent(); }

  protected check(): void { this.store.check(this.typed()); }

  protected finish(): void {
    this.playback.stop();
    this.flow.finish();
  }

  private async playCurrent(): Promise<void> {
    const i = this.store.index();
    const text = this.store.textAt(i);
    if (!text) { return; }
    this.playing.set(true);
    if (this.practice.youtubeActive()) {
      const played = await this.youtube.playSegment(i);
      if (!played) { await this.speakText(text); }
    } else {
      await this.speakText(text);
    }
    this.playing.set(false);
  }

  private speakText(text: string): Promise<void> {
    return this.speaker.speak(text, { rate: this.settings.rate(), voice: this.voices.selected() });
  }
}