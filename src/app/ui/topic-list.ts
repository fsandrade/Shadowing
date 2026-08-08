import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { PracticeStore } from '../state/practice-store';
import { SettingsStore } from '../state/settings-store';

/**
 * The topics sidebar. Declared on <aside> so no wrapper element appears between
 * `.app`'s grid and `.sidebar`, which the stylesheet's column layout requires.
 */
@Component({
  selector: 'aside[appTopicList]',
  host: { class: 'sidebar' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 class="topics-title">Topics</h2>
    <nav class="decks" id="decks" aria-label="Topics">
      <div class="decks-list">
        @for (opt of practice.deckOptions(); track opt.id) {
          <button
            type="button"
            [attr.data-deck-id]="opt.id"
            [attr.aria-current]="opt.id === settings.deckId()"
            (click)="practice.selectDeck(opt.id)"
          ><span>{{ opt.name }}</span><span class="count">{{ opt.count }}</span></button>
        }
      </div>
    </nav>
  `,
})
export class TopicList {
  protected readonly practice = inject(PracticeStore);
  protected readonly settings = inject(SettingsStore);
}
