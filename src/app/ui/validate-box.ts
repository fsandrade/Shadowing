import {
  afterRenderEffect, ChangeDetectionStrategy, Component, computed, ElementRef, inject,
  input, output, untracked,
} from '@angular/core';
import { MESSAGES } from '../state/messages';
import { type LineResult } from '../validation/validation-service';

const MAX_STARS = 5;

@Component({
  selector: 'div[appValidateBox]',
  host: {
    class: 'validate-box',
    '[class.listening]': 'result().status === "listening"',
    '[class.typing]': 'result().status === "typing"',
    '[class.scored]': 'result().status === "scored"',
    '[class.failed]': 'result().status === "failed"',
  },
  templateUrl: './validate-box.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ValidateBox {
  readonly result = input.required<LineResult>();
  readonly answered = output<string>();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly starText = computed(() => {
    const n = this.result().stars;
    if (n === null) { return ''; }
    return '★'.repeat(n) + '☆'.repeat(MAX_STARS - n);
  });

  protected readonly missedText = computed(() => {
    const missed = this.result().missed ?? [];
    return missed.length ? MESSAGES.missedWords(missed) : '';
  });

  constructor() {
    afterRenderEffect(() => {
      const typing = this.result().status === 'typing';
      untracked(() => {
        if (typing) { this.host.nativeElement.querySelector('input')?.focus(); }
      });
    });
  }
}
