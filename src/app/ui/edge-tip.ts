import {
  ChangeDetectionStrategy, Component, inject, InjectionToken, signal,
} from '@angular/core';
import { SafeStorage } from '../platform/storage';

export const EDGE_TIP_KEY = 'shadowing.edgeTip';

const AUTO_HIDE_MS = 8000;

export const IS_EDGE = new InjectionToken<boolean>('IS_EDGE', {
  providedIn: 'root',
  factory: () => /Edg\//i.test(globalThis.navigator?.userAgent ?? ''),
});

export const POINTER_IS_FINE = new InjectionToken<boolean>('POINTER_IS_FINE', {
  providedIn: 'root',
  factory: () => globalThis.matchMedia?.('(pointer: fine)').matches ?? false,
});

@Component({
  selector: 'div[appEdgeTip]',
  host: {
    class: 'snackbar',
    id: 'snackbar',
    '[class.show]': 'visible()',
  },
  templateUrl: './edge-tip.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EdgeTip {
  private readonly storage = inject(SafeStorage);
  private readonly isEdge = inject(IS_EDGE);
  private readonly pointerIsFine = inject(POINTER_IS_FINE);

  protected readonly visible = signal(false);

  protected readonly edgeHref = `microsoft-edge:${
    /^https?:/.test(globalThis.location?.protocol ?? '')
      ? globalThis.location.href
      : 'https://fsandrade.github.io/Shadowing/'
  }`;

  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    if (this.isEdge || !this.pointerIsFine) { return; }

    const tipped = this.storage.read<string | number>(EDGE_TIP_KEY);
    if (tipped === '1' || tipped === 1) { return; }

    this.visible.set(true);
    this.timer = setTimeout(() => this.visible.set(false), AUTO_HIDE_MS);
  }

  protected dismiss(): void {
    clearTimeout(this.timer);
    this.visible.set(false);
    this.storage.write(EDGE_TIP_KEY, '1');
  }
}
