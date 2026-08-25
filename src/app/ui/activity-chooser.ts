import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { type Activity, ACTIVITIES } from '../core/activity';
import { formatStudied } from '../core/timing';
import { HistoryService, type PracticeTotals } from '../data/history-service';
import { SpeechRecognizer } from '../platform/speech-recognition';
import { FlowStore } from '../state/flow-store';
import { ValidationService } from '../validation/validation-service';
import { CheckModeControl } from './check-mode';
import { CustomTopic } from './custom-topic';
import { TopicList } from './topic-list';

interface DurationOption {
  readonly min: number;
  readonly label: string;
  readonly title: string;
}

const DURATIONS: readonly DurationOption[] = [
  { min: 5, label: '5 min', title: 'Practise for 5 minutes' },
  { min: 10, label: '10 min', title: 'Practise for 10 minutes' },
  { min: 15, label: '15 min', title: 'Practise for 15 minutes' },
  // Zero is the unlimited session: the clock counts up and nothing ends the
  // activity but the Finish button.
  { min: 0, label: 'Unlimited', title: 'Practise until you finish the activity' },
];

@Component({
  selector: 'main[appActivityChooser]',
  imports: [TopicList, CustomTopic, CheckModeControl],
  host: { class: 'chooser' },
  templateUrl: './activity-chooser.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActivityChooser {
  private readonly flow = inject(FlowStore);
  private readonly validation = inject(ValidationService);
  private readonly sttSupported = inject(SpeechRecognizer).supported();

  protected readonly ACTIVITIES = ACTIVITIES;
  protected readonly DURATIONS = DURATIONS;

  private readonly history = inject(HistoryService);

  protected readonly totals = signal<PracticeTotals | null>(null);

  protected readonly studied = formatStudied;

  protected readonly chosen = signal<Activity | null>(null);
  protected readonly topicId = signal<string | null>(null);
  protected readonly minutes = signal(10);

  protected readonly custom = computed(() => this.chosen()?.id === 'custom');

  protected readonly ready = computed(() => this.chosen() !== null);

  constructor() {
    void this.history.totals().then((value) => this.totals.set(value));
  }

  protected unavailable(activity: Activity): boolean {
    return activity.needsMicrophone && !this.sttSupported;
  }

  protected choose(activity: Activity): void {
    if (this.unavailable(activity)) { return; }
    this.chosen.set(activity);
  }

  protected pickTopic(id: string | null): void {
    this.topicId.set(id);
  }

  protected pickDuration(min: number): void {
    this.minutes.set(min);
  }

  protected async begin(): Promise<void> {
    const activity = this.chosen();
    if (!activity) { return; }

    // The check-mode control writes straight through ValidationService as the
    // learner clicks it, so for My text their choice is already applied and we
    // must carry it across. Leaving it undefined would make start() fall back
    // to the custom preset ('nothing') and silently undo them.
    const checkMode = this.custom() ? this.validation.mode() : undefined;

    await this.flow.start(
      activity,
      this.custom() ? null : this.topicId(),
      this.minutes(),
      checkMode,
    );
  }
}
