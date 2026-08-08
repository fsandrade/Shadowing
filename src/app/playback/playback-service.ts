import { inject, Injectable } from '@angular/core';
import { type Rng } from '../core/shuffle';
import { stripTags } from '../core/text';
import { pauseMs } from '../core/timing';
import { Clock } from '../platform/clock';
import { Speaker } from '../platform/speaker';
import { BannerStore } from '../state/banner-store';
import { MESSAGES } from '../state/messages';
import { PracticeStore } from '../state/practice-store';
import { SessionTimerStore } from '../state/session-timer-store';
import { SettingsStore } from '../state/settings-store';
import { VoiceStore } from '../state/voice-store';
import { GapRunner } from './gap-runner';

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

@Injectable({ providedIn: 'root' })
export class PlaybackService {
  private readonly speaker = inject(Speaker);
  private readonly clock = inject(Clock);
  private readonly gap = inject(GapRunner);
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
  private silentStreak = 0;
  private validate: ValidationHook | null = null;

  /** Gap progress for the ring; the mechanics live in GapRunner. */
  readonly progress = this.gap.progress.asReadonly();
  readonly inGap = this.gap.active.asReadonly();

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
    void this.speak(this.practice.index());
  }

  /**
   * Invalidates the current run: bumps the token, ends any gap immediately and
   * silences the synthesizer. Returns the new token for the caller to own.
   */
  private bump(): number {
    this.generation++;
    this.gap.cancel();
    this.speaker.cancel();
    return this.generation;
  }

  private speak(index: number): Promise<void> {
    return this.speaker.speak(this.textAt(index), {
      rate: this.settings.rate(),
      voice: this.voices.selected(),
    });
  }

  private textAt(index: number): string {
    return stripTags(this.practice.lines()[index] ?? '');
  }

  private async runLoop(gen: number): Promise<void> {
    while (this.practice.playing() && gen === this.generation) {
      const index = this.practice.index();
      const text = this.textAt(index);

      const startedAt = this.clock.ticks();
      await this.speak(index);
      if (!this.owns(gen)) { return; }

      if (this.blameVoiceIfSilent(this.clock.ticks() - startedAt, text)) { return; }
      if (this.finishIfExpired()) { return; }

      const gapMs = Math.max(
        MIN_GAP_MS,
        pauseMs(this.clock.ticks() - startedAt, this.settings.slack()),
      );
      await this.gap.run(gapMs, this.validate?.(index, text) ?? undefined);
      if (!this.owns(gen)) { return; }
      if (this.finishIfExpired()) { return; }

      this.practice.markSpoken(index);
      this.practice.advance();
    }
  }

  /**
   * A long sentence that returned almost instantly means the voice produced no
   * audio — typically an Edge Natural voice with no network. Three in a row and
   * we stop and say so. Returns true when playback has been halted.
   */
  private blameVoiceIfSilent(speechMs: number, text: string): boolean {
    const silent = speechMs < DEAD_VOICE_MS && text.length > DEAD_VOICE_MIN_CHARS;
    if (!silent) {
      this.silentStreak = 0;
      this.timer.countSpoken();
      return false;
    }
    if (++this.silentStreak < DEAD_VOICE_STREAK) { return false; }
    this.stop();
    this.banner.show(MESSAGES.deadVoice, 'dead-voice');
    return true;
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
