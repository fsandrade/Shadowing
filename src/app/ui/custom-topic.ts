import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CUSTOM_TEXT_LIMIT } from '../core/sentences';
import { CustomTopicStore } from '../state/custom-topic-store';
import { PracticeStore } from '../state/practice-store';

@Component({
  selector: 'div[appCustomTopic]',
  host: { class: 'custom-topic' },
  templateUrl: './custom-topic.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomTopic {
  protected readonly custom = inject(CustomTopicStore);
  protected readonly practice = inject(PracticeStore);

  protected readonly LIMIT = CUSTOM_TEXT_LIMIT;

  protected readonly draft = signal('');
  protected readonly editing = signal(false);

  protected readonly open = computed(() => this.editing() || !this.custom.hasText());

  protected readonly remaining = computed(() => this.LIMIT - this.draft().length);

  protected edit(): void {
    this.draft.set(this.custom.text());
    this.editing.set(true);
  }

  protected onInput(value: string): void {
    this.draft.set(value.slice(0, this.LIMIT));
  }

  protected save(): void {
    this.custom.setText(this.draft());
    this.practice.useCustomText();
    this.editing.set(false);
  }

  protected cancel(): void {
    this.draft.set('');
    this.editing.set(false);
  }

  protected clear(): void {
    this.custom.clear();
    this.practice.useCustomText();
    this.draft.set('');
    this.editing.set(false);
  }
}
