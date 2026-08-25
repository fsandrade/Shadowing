import { computed, inject, Injectable, signal } from '@angular/core';
import { CUSTOM_TEXT_LIMIT, splitSentences } from '../core/sentences';
import { SafeStorage } from '../platform/storage';
import { TextSanitizer } from '../platform/text-sanitizer';

const KEY = 'shadowing.customTopic';

@Injectable({ providedIn: 'root' })
export class CustomTopicStore {
  private readonly storage = inject(SafeStorage);
  private readonly sanitizer = inject(TextSanitizer);

  private readonly stored = signal(this.clean(this.storage.read<unknown>(KEY)));

  readonly text = this.stored.asReadonly();

  readonly lines = computed<readonly string[]>(() => splitSentences(this.stored()));

  readonly hasText = computed(() => this.lines().length > 0);

  setText(raw: unknown): void {
    const clean = this.clean(raw);
    this.stored.set(clean);
    this.storage.write(KEY, clean);
  }

  clear(): void {
    this.stored.set('');
    this.storage.write(KEY, '');
  }

  private clean(raw: unknown): string {
    return this.sanitizer.toPlainText(raw).slice(0, CUSTOM_TEXT_LIMIT);
  }
}
