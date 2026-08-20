import { computed, inject, Injectable, signal } from '@angular/core';
import type { Activity, CheckMode } from '../core/activity';
import { pacingFor } from '../core/pacing';
import { ProgressService } from '../data/progress-service';
import { ValidationService } from '../validation/validation-service';
import { PracticeStore } from './practice-store';
import { ProfileStore } from './profile-store';
import { SessionTimerStore } from './session-timer-store';
import { SettingsStore } from './settings-store';

export type Screen = 'onboarding' | 'chooser' | 'practice' | 'summary';

export interface SessionResult {
  readonly activity: Activity;
  readonly topicId: string | null;
  readonly minutes: number;
  readonly spoken: number;
  readonly stars: number | null;
}

// Which screen the learner is on, and the transitions between them. Nothing is
// persisted: reloading mid-practice lands on the chooser, and the open session
// is closed by the pagehide handler in AppStartup.
@Injectable({ providedIn: 'root' })
export class FlowStore {
  private readonly profile = inject(ProfileStore);
  private readonly settings = inject(SettingsStore);
  private readonly practice = inject(PracticeStore);
  private readonly timer = inject(SessionTimerStore);
  private readonly validation = inject(ValidationService);
  private readonly progress = inject(ProgressService);

  private readonly running = signal<Activity | null>(null);
  private readonly finished = signal<SessionResult | null>(null);
  private readonly topic = signal<string | null>(null);

  readonly activity = this.running.asReadonly();
  readonly result = this.finished.asReadonly();

  readonly screen = computed<Screen>(() => {
    if (!this.profile.chosen()) { return 'onboarding'; }
    if (this.finished()) { return 'summary'; }
    return this.running() ? 'practice' : 'chooser';
  });

  async start(
    activity: Activity,
    topicId: string | null,
    minutes: number,
    checkMode: CheckMode = activity.preset.checkMode,
  ): Promise<void> {
    this.finished.set(null);
    this.topic.set(topicId);

    if (activity.id === 'custom') {
      this.practice.useCustomText();
    } else {
      this.practice.selectTopic(topicId);
    }

    const pacing = pacingFor(this.profile.levelId());
    this.settings.setRate(pacing.rate);
    this.settings.setSlack(pacing.slack);
    this.settings.setBlur(activity.preset.blur);
    this.settings.setRepeatUntilFive(activity.preset.repeatUntilFive);
    this.settings.setDurationMin(minutes);

    // setMode owns the microphone permission and the stt/typing flags; going
    // around it would leave the validator half-configured.
    await this.validation.setMode(checkMode);

    this.timer.reset(minutes);

    // My text never reaches the database: that content lives only in the
    // browser, and sentence_attempts.sentence_id is not nullable. Bound to a
    // local first so the narrowing reaches startSession's parameter type.
    const id = activity.id;
    if (id !== 'custom') {
      this.progress.startSession(id, topicId, minutes);
    }

    this.running.set(activity);
  }

  finish(): void {
    const activity = this.running();
    if (!activity) { return; }

    const minutes = this.settings.durationMin();
    const tally = this.timer.finish();
    this.progress.endSession();

    this.finished.set({
      activity,
      topicId: this.topic(),
      minutes,
      spoken: tally.spoken,
      stars: tally.stars,
    });
    this.running.set(null);
  }

  backToChooser(): void {
    this.finished.set(null);
    this.running.set(null);
  }
}
