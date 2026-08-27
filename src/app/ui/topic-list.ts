import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { PracticeStore } from '../state/practice-store';

@Component({
  selector: 'nav[appTopicList]',
  host: { class: 'decks', id: 'decks', 'aria-label': 'Choose a topic', tabindex: '-1' },
  templateUrl: './topic-list.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TopicList {
  protected readonly practice = inject(PracticeStore);

  readonly selected = input<string | null>(null);
  readonly pick = output<string | null>();
}
