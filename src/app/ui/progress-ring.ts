import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

const RADIUS = 8;
export const RING_LENGTH = 2 * Math.PI * RADIUS;

@Component({
  selector: 'svg[appProgressRing]',
  host: {
    class: 'ring',
    viewBox: '0 0 20 20',
    width: '18',
    height: '18',
    'aria-hidden': 'true',
  },
  templateUrl: './progress-ring.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProgressRing {
  readonly progress = input.required<number>();

  protected readonly RADIUS = RADIUS;
  protected readonly dashArray = RING_LENGTH.toFixed(2);

  protected readonly dashOffset = computed(() =>
    (RING_LENGTH * (1 - this.progress())).toFixed(2),
  );
}
