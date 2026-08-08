import {
  ChangeDetectionStrategy, Component, inject, InjectionToken, signal,
} from '@angular/core';
import { SafeStorage } from '../platform/storage';

export const EDGE_TIP_KEY = 'shadowing.edgeTip';

/** Auto-dismiss delay, matching the vanilla snack bar. */
const AUTO_HIDE_MS = 8000;

export const IS_EDGE = new InjectionToken<boolean>('IS_EDGE', {
  providedIn: 'root',
  factory: () => /Edg\//i.test(globalThis.navigator?.userAgent ?? ''),
});

export const POINTER_IS_FINE = new InjectionToken<boolean>('POINTER_IS_FINE', {
  providedIn: 'root',
  factory: () => globalThis.matchMedia?.('(pointer: fine)').matches ?? false,
});

/**
 * A one-time nudge toward Edge, which ships the best English voices. Shown only
 * on non-Edge desktop browsers, and only until dismissed.
 */
@Component({
  selector: 'div[appEdgeTip]',
  host: {
    class: 'snackbar',
    id: 'snackbar',
    '[class.show]': 'visible()',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span>Tip: for the best English voices, try practicing in
      <a id="edge-link" [href]="edgeHref">Microsoft Edge</a>.</span>
    <button type="button" class="snackbar-close" aria-label="Dismiss"
      title="Dismiss" (click)="dismiss()">&#215;</button>
  `,
})
export class EdgeTip {
  private readonly storage = inject(SafeStorage);
  private readonly isEdge = inject(IS_EDGE);
  private readonly pointerIsFine = inject(POINTER_IS_FINE);

  protected readonly visible = signal(false);

  /** Deep-links the current page into Edge, falling back to the public site. */
  protected readonly edgeHref = `microsoft-edge:${
    /^https?:/.test(globalThis.location?.protocol ?? '')
      ? globalThis.location.href
      : 'https://fsandrade.github.io/Shadowing/'
  }`;

  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    if (this.isEdge || !this.pointerIsFine) { return; }

    // The vanilla app wrote a bare 1; SafeStorage now writes "1". Accept both,
    // so a returning user's dismissal is still honoured.
    const tipped = this.storage.read<string | number>(EDGE_TIP_KEY);
    if (tipped === '1' || tipped === 1) { return; }

    this.visible.set(true);
    this.timer = setTimeout(() => this.visible.set(false), AUTO_HIDE_MS);
  }

  /** An explicit dismiss is remembered; the auto-hide is not. */
  protected dismiss(): void {
    clearTimeout(this.timer);
    this.visible.set(false);
    this.storage.write(EDGE_TIP_KEY, '1');
  }
}
