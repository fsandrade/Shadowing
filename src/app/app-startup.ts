import { effect, inject, Injectable, untracked } from '@angular/core';
import { isKnownLevel } from './core/catalog';
import { ProgressService } from './data/progress-service';
import { DebugBridge } from './debug-bridge';
import { AuthStore } from './platform/auth';
import { PlaybackService } from './playback/playback-service';
import { MicrophoneService } from './platform/microphone';
import { Speaker } from './platform/speaker';
import { BannerStore } from './state/banner-store';
import { CATALOG } from './state/catalog-token';
import { MESSAGES } from './state/messages';
import { PracticeStore } from './state/practice-store';
import { SessionTimerStore } from './state/session-timer-store';
import { SettingsStore } from './state/settings-store';
import { VoiceStore } from './state/voice-store';
import { type LineResult, ValidationService } from './validation/validation-service';

const CLOCK_TICK_MS = 250;

const KEEPALIVE_MS = 10_000;
const MAX_REPEATS = 5;
const MAX_STARS = 5;

@Injectable({ providedIn: 'root' })
export class AppStartup {
  private readonly catalog = inject(CATALOG);
  private readonly settings = inject(SettingsStore);
  private readonly practice = inject(PracticeStore);
  private readonly timer = inject(SessionTimerStore);
  private readonly banner = inject(BannerStore);
  private readonly voices = inject(VoiceStore);
  private readonly speaker = inject(Speaker);
  private readonly playback = inject(PlaybackService);
  private readonly validation = inject(ValidationService);
  private readonly mic = inject(MicrophoneService);
  private readonly debug = inject(DebugBridge);
  private readonly auth = inject(AuthStore);
  private readonly progress = inject(ProgressService);

  run(): void {
    this.forgetLevelThatNoLongerExists();

    this.timer.reset(this.settings.durationMin());
    this.voices.refresh();
    this.watchAudioAvailability();

    setInterval(() => this.timer.tick(), CLOCK_TICK_MS);
    setInterval(() => this.speaker.keepAlive(), KEEPALIVE_MS);

    this.auth.watch();

    this.progress.flush();

    this.attachValidator();
    this.trackSessions();
    this.dropResultsWhenOrderChanges();
    this.releaseMicOnUnload();
    this.debug.install();
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
        this.timer.recordStars(lineIndex, result?.stars ?? 0);
        this.recordAttempt(lineIndex, plainText, result);
      }) ?? null;
    });

    this.playback.setValidationTiming(() => this.settings.typingMode());
    this.playback.setValidationAbort(() => this.validation.dispose());

    this.playback.setRepeatPolicy((lineIndex, repeatsDone) => {
      if (!this.settings.sttEnabled() || !this.settings.repeatUntilFive()) { return false; }
      if (repeatsDone >= MAX_REPEATS) { return false; }
      if (this.mic.denied() && !this.settings.typingMode()) { return false; }
      const result = this.validation.results().get(lineIndex);
      if (!result) { return false; }
      return result.stars === null || result.stars < MAX_STARS;
    });
  }

  private forgetLevelThatNoLongerExists(): void {
    const levelId = this.settings.levelId();
    if (levelId !== null && !isKnownLevel(this.catalog, levelId)) {
      this.settings.setLevelId(null);
    }
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

  private trackSessions(): void {
    let previousDuration = this.settings.durationMin();
    let previousFinishes = this.timer.sessionsFinished();

    effect(() => {
      const minutes = this.settings.durationMin();
      const finishes = this.timer.sessionsFinished();
      untracked(() => {
        if (minutes === previousDuration && finishes === previousFinishes) { return; }
        previousDuration = minutes;
        previousFinishes = finishes;
        this.progress.endSession();
      });
    });
  }

  private releaseMicOnUnload(): void {
    const release = () => {
      this.mic.release();

      this.progress.endSession();
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
