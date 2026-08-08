import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { type LineResult } from '../validation/validation-service';

const MAX_STARS = 5;

@Component({
  selector: 'div[appValidateBox]',
  host: {
    class: 'validate-box',
    '[class.listening]': 'result().status === "listening"',
    '[class.scored]': 'result().status === "scored"',
    '[class.failed]': 'result().status === "failed"',
  },
  templateUrl: './validate-box.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ValidateBox {
  readonly result = input.required<LineResult>();

  protected readonly starText = computed(() => {
    const n = this.result().stars;
    if (n === null) { return ''; }
    return '★'.repeat(n) + '☆'.repeat(MAX_STARS - n);
  });
}
