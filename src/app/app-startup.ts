import { effect, inject, Injectable, untracked } from '@angular/core';
import { MAX_STARS } from './core/scoring';
import { ProgressService } from './data/progress-service';
import { PlaybackService } from './playback/playback-service';
import { MicrophoneService } from './platform/microphone';
import { Speaker } from './platform/speaker';
import { BannerStore } from './state/banner-store';
import { MESSAGES } from './state/messages';
import { PracticeStore } from './state/practice-store';
import { SessionTimerStore } from './state/session-timer-store';
import { SettingsStore } from './state/settings-store';
import { VoiceStore } from './state/voice-store';
import { type LineResult, ValidationService } from './validation/validation-service';
const CLOCK_TICK_MS = 250;

const KEEPALIVE_MS = 10_000;

const MAX_REPEATS = 5;

@Injectable({ providedIn: 'root' })
export class AppStartup {
  private readonly settings = inject(SettingsStore);
  private readonly practice = inject(PracticeStore);
  private readonly timer = inject(SessionTimerStore);
  private readonly banner = inject(BannerStore);
  private readonly voices = inject(VoiceStore);
  private readonly speaker = inject(Speaker);
  private readonly playback = inject(PlaybackService);
  private readonly validation = inject(ValidationService);
  private readonly mic = inject(MicrophoneService);
  private readonly progress = inject(ProgressService);

  run(): void {
    this.timer.reset(this.settings.durationMin());
    this.voices.refresh();
    this.watchAudioAvailability();

    setInterval(() => this.timer.tick(), CLOCK_TICK_MS);
    setInterval(() => this.speaker.keepAlive(), KEEPALIVE_MS);

    this.attachValidator();
    this.attachRepeatPolicy();
    this.dropResultsWhenOrderChanges();
    this.releaseMicOnUnload();
  }

  private dropResultsWhenOrderChanges(): void {
    let firstRun = true;
    effect(() => {
      this.practice.lines();
      untracked(() => {
        if (firstRun) {
          firstRun = false;
          return;
        }
        this.validation.reset();
      });
    });
  }

  private attachValidator(): void {
    this.playback.setValidationHook((lineIndex, plainText) => {
      if (!this.settings.sttEnabled()) { return null; }
      const done = this.validation.begin(lineIndex, plainText);
      return done?.finally(() => {
        this.validation.dispose();
        const result = this.validation.results().get(lineIndex);
        if (result?.status !== 'scored' && result?.status !== 'failed') { return; }
        this.timer.recordStars(lineIndex, result.stars ?? 0);
        this.recordAttempt(lineIndex, plainText, result);
      }) ?? null;
    });

    this.playback.setValidationAbort(() => this.validation.cancel());
  }

  private attachRepeatPolicy(): void {
    this.playback.setRepeatPolicy((lineIndex, repeatsDone) => {
      if (!this.settings.sttEnabled() || !this.settings.repeatUntilFive()) { return false; }
      if (repeatsDone >= MAX_REPEATS) { return false; }

      const result = this.validation.results().get(lineIndex);
      return !result || result.stars === null || result.stars < MAX_STARS;
    });
  }

  private recordAttempt(
    lineIndex: number,
    plainText: string,
    result: LineResult | undefined,
  ): void {
    if (result?.status !== 'scored' && result?.status !== 'failed') { return; }

    const line = this.practice.lines()[lineIndex];
    if (!line) { return; }

    this.progress.record({
      line,
      baseText: plainText,
      transcript: result.transcript,
      stars: result.stars,
      status: result.status,
    });
  }

  private releaseMicOnUnload(): void {
    const release = () => {
      this.mic.release();

      
      
      this.progress.endSession(this.timer.consumedMs());
    };
    addEventListener('pagehide', release);
    addEventListener('beforeunload', release);
  }

  private watchAudioAvailability(): void {
    if (!this.speaker.supported) {
      this.banner.show(MESSAGES.speechUnsupported, 'unsupported');
      return;
    }
    effect(() => {
      if (this.voices.voices().length && !this.voices.hasEnglish()) {
        this.playback.stop();
        this.banner.show(MESSAGES.noEnglishVoice, 'no-voice');
      } else {
        this.banner.clear('no-voice');
      }
    });
  }
}
