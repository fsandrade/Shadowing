import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ValidationService } from '../validation/validation-service';

const MAX_STARS = 5;

/** The inline validator result, rendered as a sibling of the current line. */
@Component({
  selector: 'div[appValidateBox]',
  host: { class: 'validate-box' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="mic-dot"></span>
    <span class="transcript">{{ validation.transcript() }}</span>
    <span class="stars">{{ starText() }}</span>
  `,
})
export class ValidateBox {
  protected readonly validation = inject(ValidationService);

  /** Filled then empty stars, or nothing at all when unrated. */
  protected readonly starText = computed(() => {
    const n = this.validation.stars();
    if (n === null) { return ''; }
    return '★'.repeat(n) + '☆'.repeat(MAX_STARS - n);
  });
}
