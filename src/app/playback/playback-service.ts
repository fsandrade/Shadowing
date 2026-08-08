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

export type ValidationHook = (
  lineIndex: number,
  plainText: string,
) => Promise<void> | null;

export type RepeatPolicy = (lineIndex: number, repeatsDone: number) => boolean;

const MIN_GAP_MS = 400;
const DEAD_VOICE_MS = 150;
const DEAD_VOICE_MIN_CHARS = 15;
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

  private generation = 0;
  private silentStreak = 0;
  private validate: ValidationHook | null = null;
  private shouldRepeat: RepeatPolicy | null = null;

  readonly progress = this.gap.progress.asReadonly();
  readonly inGap = this.gap.active.asReadonly();

  setValidationHook(fn: ValidationHook | null): void {
    this.validate = fn;
  }

  setRepeatPolicy(fn: RepeatPolicy | null): void {
    this.shouldRepeat = fn;
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

  next(): void {
    this.practice.markSpoken(this.practice.index());
    this.practice.advance();
    if (this.practice.playing()) { this.play(); } else { this.bump(); }
  }

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

  playLine(i: number): void {
    this.practice.goTo(i);
    if (this.practice.playing()) {
      this.play();
      return;
    }
    const gen = this.bump();
    void this.runOnce(gen, i).catch(() => {});
  }

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

  private gapMsFor(startedAt: number): number {
    return Math.max(
      MIN_GAP_MS,
      pauseMs(this.clock.ticks() - startedAt, this.settings.slack()),
    );
  }

  private async runOnce(gen: number, index: number): Promise<void> {
    const text = this.textAt(index);
    const startedAt = this.clock.ticks();

    await this.speak(index);
    if (gen !== this.generation) { return; }

    const listening = this.validate?.(index, text);
    if (!listening) { return; }

    this.practice.markSpoken(index);
    await this.gap.run(this.gapMsFor(startedAt), listening);
  }

  private async runLoop(gen: number): Promise<void> {
    let repeatsDone = 0;

    while (this.practice.playing() && gen === this.generation) {
      const index = this.practice.index();
      const text = this.textAt(index);

      const startedAt = this.clock.ticks();
      await this.speak(index);
      if (!this.owns(gen)) { return; }

      if (this.blameVoiceIfSilent(this.clock.ticks() - startedAt, text)) { return; }
      if (this.finishIfExpired()) { return; }

      await this.gap.run(this.gapMsFor(startedAt), this.validate?.(index, text) ?? undefined);
      if (!this.owns(gen)) { return; }
      if (this.finishIfExpired()) { return; }

      if (this.shouldRepeat?.(index, repeatsDone)) {
        repeatsDone++;
        continue;
      }

      repeatsDone = 0;
      this.practice.markSpoken(index);
      this.practice.advance();
    }
  }

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
