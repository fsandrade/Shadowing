import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { stripTags } from '../core/text';
import { isTypingCorrect } from '../core/typing';
import { ProgressService } from '../data/progress-service';
import { FlowStore } from './flow-store';
import { PracticeStore } from './practice-store';
import { SessionTimerStore } from './session-timer-store';

export type ChallengeStatus = 'todo' | 'correct' | 'incorrect';

@Injectable({ providedIn: 'root' })
export class DictationStore {
  private readonly practice = inject(PracticeStore);
  private readonly timer = inject(SessionTimerStore);
  private readonly progress = inject(ProgressService);
  private readonly flow = inject(FlowStore);

  readonly lines = this.practice.lines;
  readonly index = this.practice.index;

  readonly statuses = signal<ReadonlyMap<number, ChallengeStatus>>(new Map());
  readonly revealed = signal<ReadonlySet<number>>(new Set());
  readonly showAnswerImmediately = signal(true);
  readonly showFull = signal(false);

  readonly resolvedCount = computed(() => [...this.statuses().values()].filter((s) => s !== 'todo').length);

  constructor() {
    // A fresh session reshuffles or swaps the source, which recomputes lines():
    // the per-index verdicts from the previous run must not leak onto a session
    // that never answered them.
    // A fresh session reshuffles or swaps the source, which recomputes lines():
    // the per-index verdicts from the previous run must not leak onto a session
    // that never answered them. Restarting the SAME My text or YouTube source
    // leaves lines() cached (useCustomText/useYoutube write the same source), so
    // kind() - null -> 'dictation' on every start - is the dependable stamp.
    effect(() => {
      this.flow.kind();
      this.lines();
      this.reset();
    });
  }

  status(i: number): ChallengeStatus { return this.statuses().get(i) ?? 'todo'; }

  textAt(i: number): string {
    const line = this.lines()[i] ?? '';
    return this.practice.customActive() || this.practice.youtubeActive() ? line : stripTags(line);
  }

  check(typed: string): ChallengeStatus {
    const i = this.index();
    const base = this.textAt(i);
    const correct = isTypingCorrect(base, typed);

    const statuses = new Map(this.statuses());
    statuses.set(i, correct ? 'correct' : 'incorrect');
    this.statuses.set(statuses);

    if (correct || this.showAnswerImmediately()) {
      const revealed = new Set(this.revealed());
      revealed.add(i);
      this.revealed.set(revealed);
    }

    this.timer.countSpoken(i);
    this.timer.recordStars(i, correct ? 5 : 0);
    this.progress.record({
      line: this.lines()[i] ?? '',
      baseText: base,
      transcript: typed,
      stars: correct ? 5 : null,
      status: correct ? 'scored' : 'failed',
    });

    return correct ? 'correct' : 'incorrect';
  }

  skip(): void {
    const i = this.index();
    const statuses = new Map(this.statuses());
    statuses.set(i, 'incorrect');
    this.statuses.set(statuses);
    const revealed = new Set(this.revealed());
    revealed.add(i);
    this.revealed.set(revealed);
    this.next();
  }

  revealFull(): void {
    const i = this.index();
    const revealed = new Set(this.revealed());
    revealed.add(i);
    this.revealed.set(revealed);
  }

  reset(): void {
    this.statuses.set(new Map());
    this.revealed.set(new Set());
  }

  goTo(i: number): void { this.practice.goTo(i); }
  next(): void { this.practice.advance(); }
  back(): void { this.practice.back(); }
}