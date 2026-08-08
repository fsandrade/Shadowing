import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { PracticeStore } from '../state/practice-store';
import { SettingsStore } from '../state/settings-store';

@Component({
  selector: 'aside[appTopicList]',
  host: { class: 'sidebar' },
  templateUrl: './topic-list.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TopicList {
  protected readonly practice = inject(PracticeStore);
  protected readonly settings = inject(SettingsStore);
}
