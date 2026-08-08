import { inject, Injectable, signal } from '@angular/core';
import { type Rng } from '../core/shuffle';
import { stripTags } from '../core/text';
import { pauseMs } from '../core/timing';
import { Clock, type PendingWait } from '../platform/clock';
import { Speaker } from '../platform/speaker';
import { BannerStore } from '../state/banner-store';
import { MESSAGES } from '../state/messages';
import { PracticeStore } from '../state/practice-store';
import { SessionTimerStore } from '../state/session-timer-store';
import { SettingsStore } from '../state/settings-store';
import { VoiceStore } from '../state/voice-store';

/**
 * Called at the start of each gap when the speech validator is on. Returning a
 * promise makes the gap end as soon as it resolves; returning null just runs
 * the gap to its full length.
 */
export type ValidationHook = (
  lineIndex: number,
  plainText: string,
) => Promise<void> | null;

/** Shortest gap we ever give, even at slack 0. */
const MIN_GAP_MS = 400;
/** An utterance shorter than this, for text longer than the char floor, is silent. */
const DEAD_VOICE_MS = 150;
const DEAD_VOICE_MIN_CHARS = 15;
/** Consecutive silent utterances before we blame the voice. */
const DEAD_VOICE_STREAK = 3;
/** How often the gap ring samples its progress. */
const PROGRESS_SAMPLE_MS = 50;

@Injectable({ providedIn: 'root' })
export class PlaybackService {
  private readonly speaker = inject(Speaker);
  private readonly clock = inject(Clock);
  private readonly practice = inject(PracticeStore);
  private readonly settings = inject(SettingsStore);
  private readonly timer = inject(SessionTimerStore);
  private readonly banner = inject(BannerStore);
  private readonly voices = inject(VoiceStore);

  /**
   * Monotonic run token. Every control bumps it; the loop compares it on each
   * await boundary and returns if it no longer owns the run. This is what makes
   * cancellation safe without tearing down mid-utterance state.
   */
  private generation = 0;
  private gap: PendingWait | null = null;
  private silentStreak = 0;
  private validate: ValidationHook | null = null;

  /** Gap completion, 0 to 1, for the progress ring. */
  readonly progress = signal(0);

  /**
   * True for the whole duration of a gap. The ring mounts and unmounts on this
   * rather than on `progress > 0`, so it is present at offset-full from the
   * first frame and visibly drains, as the vanilla ring did.
   */
  readonly inGap = signal(false);

  setValidationHook(fn: ValidationHook | null): void {
    this.validate = fn;
  }

  play(): void {
    if (!this.practice.hasLines()) { return; }
    const gen = this.bump();
    this.timer.accrue();
    this.practice.setPlaying(true);
    this.timer.resume();
    this.banner.clearAll();
    void this.runLoop(gen).catch(() => this.stop());
  }

  pause(): void {
    this.stop();
  }

  toggle(): void {
    if (this.practice.playing()) {
      this.pause();
    } else {
      this.silentStreak = 0;
      this.play();
    }
  }

  stop(): void {
    this.bump();
    this.timer.accrue();
    this.practice.setPlaying(false);
    this.progress.set(0);
    this.inGap.set(false);
  }

  /** Advances one line, restarting playback if it was running. */
  next(): void {
    this.practice.markSpoken(this.practice.index());
    this.practice.advance();
    if (this.practice.playing()) { this.play(); } else { this.bump(); }
  }

  /** Steps back one line and (re)starts playback, as ArrowLeft does. */
  previous(): void {
    this.practice.back();
    this.silentStreak = 0;
    this.play();
  }

  shuffle(rng?: Rng): void {
    const wasPlaying = this.practice.playing();
    this.stop();
    this.practice.shuffleLines(rng);
    if (wasPlaying) { this.play(); }
  }

  /** Jumps to a line: speaks it alone when paused, resumes the loop when playing. */
  playLine(i: number): void {
    this.practice.goTo(i);
    if (this.practice.playing()) {
      this.play();
      return;
    }
    this.bump();
    void this.speakCurrent();
  }

  /**
   * Invalidates the current run: bumps the token, ends any gap immediately and
   * silences the synthesizer. Returns the new token for the caller to own.
   */
  private bump(): number {
    this.generation++;
    this.gap?.resolveNow();
    this.gap = null;
    this.speaker.cancel();
    return this.generation;
  }

  private speakCurrent(): Promise<void> {
    const text = stripTags(this.practice.lines()[this.practice.index()] ?? '');
    return this.speaker.speak(text, {
      rate: this.settings.rate(),
      voice: this.voices.selected(),
    });
  }

  private async runLoop(gen: number): Promise<void> {
    while (this.practice.playing() && gen === this.generation) {
      const index = this.practice.index();
      const text = stripTags(this.practice.lines()[index] ?? '');

      const startedAt = this.clock.ticks();
      await this.speaker.speak(text, {
        rate: this.settings.rate(),
        voice: this.voices.selected(),
      });
      if (!this.owns(gen)) { return; }

      const speechMs = this.clock.ticks() - startedAt;
      if (this.looksSilent(speechMs, text)) {
        if (++this.silentStreak >= DEAD_VOICE_STREAK) {
          this.stop();
          this.banner.show(MESSAGES.deadVoice, 'dead-voice');
          return;
        }
      } else {
        this.silentStreak = 0;
        this.timer.countSpoken();
      }

      if (this.finishIfExpired()) { return; }

      const gapMs = Math.max(
        MIN_GAP_MS,
        pauseMs(this.clock.ticks() - startedAt, this.settings.slack()),
      );
      await this.runGap(gapMs, index, text);
      if (!this.owns(gen)) { return; }

      if (this.finishIfExpired()) { return; }

      this.practice.markSpoken(index);
      this.practice.advance();
    }
  }

  private async runGap(gapMs: number, index: number, text: string): Promise<void> {
    const startedAt = this.clock.ticks();
    this.progress.set(0);
    this.inGap.set(true);

    const validation = this.validate?.(index, text) ?? undefined;
    this.gap = this.clock.wait(gapMs, validation ?? undefined);

    // Sample progress alongside the wait; the ring reads this signal.
    const sampler = setInterval(() => {
      const p = (this.clock.ticks() - startedAt) / gapMs;
      this.progress.set(Math.min(1, Math.max(0, p)));
    }, PROGRESS_SAMPLE_MS);

    try {
      await this.gap.done;
    } finally {
      clearInterval(sampler);
      this.gap = null;
      this.inGap.set(false);
      this.progress.set(0);
    }
  }

  /**
   * A long sentence that returned almost instantly means the voice produced no
   * audio — typically an Edge Natural voice with no network.
   */
  private looksSilent(speechMs: number, text: string): boolean {
    return speechMs < DEAD_VOICE_MS && text.length > DEAD_VOICE_MIN_CHARS;
  }

  private finishIfExpired(): boolean {
    if (!this.timer.expired()) { return false; }
    const minutes = this.settings.durationMin();
    this.stop();
    const spoken = this.timer.finish();
    this.banner.show(MESSAGES.sessionSummary(minutes, spoken), 'summary');
    return true;
  }

  private owns(gen: number): boolean {
    return gen === this.generation && this.practice.playing();
  }
}
