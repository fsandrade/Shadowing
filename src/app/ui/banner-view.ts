import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { BannerStore } from '../state/banner-store';

/**
 * The single error/summary slot. `[innerHTML]` routes through DomSanitizer, so
 * the <b> and <code> in MESSAGES render while anything unexpected is stripped —
 * strictly safer than the vanilla app's direct innerHTML assignment.
 */
@Component({
  selector: 'div[appBanner]',
  host: {
    class: 'banner',
    id: 'banner',
    '[class.show]': 'banner.visible()',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span [innerHTML]="banner.html()"></span>`,
})
export class BannerView {
  protected readonly banner = inject(BannerStore);
}
