import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { BannerStore } from '../state/banner-store';

@Component({
  selector: 'div[appBanner]',
  host: {
    class: 'banner',
    id: 'banner',
    '[class.show]': 'banner.visible()',
  },
  templateUrl: './banner-view.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BannerView {
  protected readonly banner = inject(BannerStore);
}
