import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import type { DeckCounts } from '../core/progression';
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
  readonly hasPick = input(false);
  readonly pick = output<string | null>();

  protected countsFor(topicId: string | null): DeckCounts {
    return this.practice.countsFor(topicId);
  }

  protected countLabel(topicId: string | null): string {
    const counts = this.countsFor(topicId);
    return `${counts.fresh} new, ${counts.learning} learning, ${counts.due} due`;
  }
}
