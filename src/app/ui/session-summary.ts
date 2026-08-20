import {
  ChangeDetectionStrategy, Component, computed, inject, signal,
} from '@angular/core';
import { formatPractised } from '../core/timing';
import { type AccumulatedProgress, HistoryService } from '../data/history-service';
import { FlowStore } from '../state/flow-store';
import { PracticeStore } from '../state/practice-store';
import { ProfileStore } from '../state/profile-store';

@Component({
  selector: 'main[appSessionSummary]',
  host: { class: 'summary' },
  templateUrl: './session-summary.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SessionSummary {
  private readonly history = inject(HistoryService);
  private readonly practice = inject(PracticeStore);
  private readonly profile = inject(ProfileStore);

  protected readonly flow = inject(FlowStore);

  protected readonly progress = signal<AccumulatedProgress | null>(null);

  protected readonly practised = computed(() => {
    const result = this.flow.result();
    return result ? formatPractised(result.practisedMs) : '';
  });

  // Which topic, not just which activity - two Speaking sessions in a row are
  // otherwise indistinguishable here. My text has no topic to name.
  protected readonly title = computed(() => {
    const result = this.flow.result();
    if (!result) { return ''; }
    if (result.activity.id === 'custom') { return result.activity.name; }

    const topic = this.practice.topics().find((t) => t.id === result.topicId);
    return `${result.activity.name} · ${topic?.name ?? 'All topics'}`;
  });

  // Stars per sentence, so a long session and a short one can be compared.
  // Null whenever the stars stat is, and the template hides it the same way.
  protected readonly average = computed<string | null>(() => {
    const result = this.flow.result();
    if (!result || result.stars === null || result.spoken === 0) { return null; }
    return (result.stars / result.spoken).toFixed(1);
  });

  constructor() {
    void this.history
      .accumulated(this.profile.levelId())
      .then((value) => this.progress.set(value));
  }
}
