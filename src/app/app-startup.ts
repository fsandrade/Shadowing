import { effect, inject, Injectable, untracked } from '@angular/core';
import { ALL_DECK_ID, CUSTOM_DECK_ID, linesFor } from './core/deck';
import { DebugBridge } from './debug-bridge';
import { PlaybackService } from './playback/playback-service';
import { MicrophoneService } from './platform/microphone';
import { Speaker } from './platform/speaker';
import { BannerStore } from './state/banner-store';
import { CORPUS_DATA } from './state/corpus-token';
import { MESSAGES } from './state/messages';
import { PracticeStore } from './state/practice-store';
import { SessionTimerStore } from './state/session-timer-store';
import { SettingsStore } from './state/settings-store';
import { VoiceStore } from './state/voice-store';
import { ValidationService } from './validation/validation-service';

const CLOCK_TICK_MS = 250;

const KEEPALIVE_MS = 10_000;
const MAX_REPEATS = 5;
const MAX_STARS = 5;

@Injectable({ providedIn: 'root' })
export class AppStartup {
  private readonly corpus = inject(CORPUS_DATA);
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

  run(): void {
    const deckId = this.settings.deckId();
    if (deckId !== CUSTOM_DECK_ID && !linesFor(this.corpus, deckId).length) {
      this.settings.setDeckId(ALL_DECK_ID);
    }

    this.timer.reset(this.settings.durationMin());
    this.voices.refresh();
    this.watchAudioAvailability();

    setInterval(() => this.timer.tick(), CLOCK_TICK_MS);
    setInterval(() => this.speaker.keepAlive(), KEEPALIVE_MS);

    this.attachValidator();
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
        this.timer.recordStars(lineIndex, this.validation.results().get(lineIndex)?.stars ?? 0);
      }) ?? null;
    });

    this.playback.setRepeatPolicy((lineIndex, repeatsDone) => {
      if (!this.settings.sttEnabled() || !this.settings.repeatUntilFive()) { return false; }
      if (this.mic.denied() || repeatsDone >= MAX_REPEATS) { return false; }
      const result = this.validation.results().get(lineIndex);
      if (!result) { return false; }
      return result.stars === null || result.stars < MAX_STARS;
    });
  }

  private releaseMicOnUnload(): void {
    const release = () => this.mic.release();
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
