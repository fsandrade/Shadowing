import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { type AccumulatedProgress, HistoryService } from '../data/history-service';
import { FlowStore } from '../state/flow-store';
import { ProfileStore } from '../state/profile-store';

@Component({
  selector: 'main[appSessionSummary]',
  host: { class: 'summary' },
  templateUrl: './session-summary.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SessionSummary {
  private readonly history = inject(HistoryService);
  private readonly profile = inject(ProfileStore);

  protected readonly flow = inject(FlowStore);

  protected readonly progress = signal<AccumulatedProgress | null>(null);

  constructor() {
    void this.history
      .accumulated(this.profile.levelId())
      .then((value) => this.progress.set(value));
  }
}
