import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { PracticeStore } from '../state/practice-store';

@Component({
  selector: 'aside[appTopicList]',
  host: { class: 'sidebar' },
  templateUrl: './topic-list.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TopicList {
  protected readonly practice = inject(PracticeStore);

  protected toggleCustom(): void {
    if (this.practice.customActive()) {
      this.practice.useCatalog();
    } else {
      this.practice.useCustomText();
    }
  }
}
