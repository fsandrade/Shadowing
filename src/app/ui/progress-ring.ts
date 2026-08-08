import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

const RADIUS = 8;
export const RING_LENGTH = 2 * Math.PI * RADIUS;

/**
 * The gap countdown ring. Declared on <svg> with the `ring` class so the
 * existing `.lines p.current .ring` rules (including the -90deg rotation) apply.
 * Replaces the imperative createElementNS block in the vanilla app.
 */
@Component({
  selector: 'svg[appProgressRing]',
  host: {
    class: 'ring',
    viewBox: '0 0 20 20',
    width: '18',
    height: '18',
    'aria-hidden': 'true',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg:circle
      class="ring-track"
      cx="10" cy="10" [attr.r]="RADIUS" fill="none" stroke-width="3"
    />
    <svg:circle
      class="ring-fill"
      cx="10" cy="10" [attr.r]="RADIUS" fill="none" stroke-width="3"
      [attr.stroke-dasharray]="dashArray"
      [attr.stroke-dashoffset]="dashOffset()"
    />
  `,
})
export class ProgressRing {
  /** Gap completion, 0 to 1. */
  readonly progress = input.required<number>();

  protected readonly RADIUS = RADIUS;
  protected readonly dashArray = RING_LENGTH.toFixed(2);

  /** Full circumference at 0 (empty), zero at 1 (complete). */
  protected readonly dashOffset = computed(() =>
    (RING_LENGTH * (1 - this.progress())).toFixed(2),
  );
}
