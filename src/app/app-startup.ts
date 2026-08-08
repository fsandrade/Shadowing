import { effect, inject, Injectable } from '@angular/core';
import { ALL_DECK_ID, linesFor } from './core/deck';
import { DebugBridge } from './debug-bridge';
import { PlaybackService } from './playback/playback-service';
import { Speaker } from './platform/speaker';
import { BannerStore } from './state/banner-store';
import { CORPUS_DATA } from './state/corpus-token';
import { MESSAGES } from './state/messages';
import { SessionTimerStore } from './state/session-timer-store';
import { SettingsStore } from './state/settings-store';
import { VoiceStore } from './state/voice-store';

/** How often the clock text refreshes, matching the vanilla setInterval. */
const CLOCK_TICK_MS = 250;
/** Chrome silently pauses long-lived synthesis; poke it on this interval. */
const KEEPALIVE_MS = 10_000;

/** Reproduces the vanilla init() sequence, in order. */
@Injectable({ providedIn: 'root' })
export class AppStartup {
  private readonly corpus = inject(CORPUS_DATA);
  private readonly settings = inject(SettingsStore);
  private readonly timer = inject(SessionTimerStore);
  private readonly banner = inject(BannerStore);
  private readonly voices = inject(VoiceStore);
  private readonly speaker = inject(Speaker);
  private readonly playback = inject(PlaybackService);
  private readonly debug = inject(DebugBridge);

  run(): void {
    // A remembered deck that no longer has lines falls back to All.
    if (!linesFor(this.corpus, this.settings.deckId()).length) {
      this.settings.setDeckId(ALL_DECK_ID);
    }

    this.timer.reset(this.settings.durationMin());
    this.voices.refresh();
    this.watchAudioAvailability();

    setInterval(() => this.timer.tick(), CLOCK_TICK_MS);
    setInterval(() => this.speaker.keepAlive(), KEEPALIVE_MS);

    this.debug.install();
  }

  /**
   * Two distinct failures share the banner: the platform has no synthesis at
   * all, or it has synthesis but no English voice. The second can resolve
   * itself once `voiceschanged` fires, so it is cleared as well as raised.
   */
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
