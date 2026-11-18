import {
  ChangeDetectionStrategy, Component, computed, inject, signal,
} from '@angular/core';
import { formatPractised } from '../core/timing';
import { type AccumulatedProgress, HistoryService } from '../data/history-service';
import { FlowStore } from '../state/flow-store';
import { PracticeStore } from '../state/practice-store';

@Component({
  selector: 'main[appSessionSummary]',
  host: { class: 'summary' },
  templateUrl: './session-summary.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SessionSummary {
  private readonly history = inject(HistoryService);
  private readonly practice = inject(PracticeStore);

  protected readonly flow = inject(FlowStore);

  protected readonly progress = signal<AccumulatedProgress | null>(null);

  protected readonly practised = computed(() => {
    const result = this.flow.result();
    return result ? formatPractised(result.practisedMs) : '';
  });

  protected readonly title = computed(() => {
    const result = this.flow.result();
    if (!result) { return ''; }
    if (result.source !== 'catalog') { return result.name; }
    const topic = this.practice.topics().find((t) => t.id === result.topicId);
    return `${result.name} · ${topic?.name ?? 'All topics'}`;
  });

  protected readonly average = computed<string | null>(() => {
    const result = this.flow.result();
    if (!result || result.stars === null || result.spoken === 0) { return null; }
    return (result.stars / result.spoken).toFixed(1);
  });

  constructor() {
    this.progress.set(this.history.accumulated());
  }
}
