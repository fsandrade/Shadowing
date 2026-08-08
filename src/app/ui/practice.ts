import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { BannerView } from './banner-view';
import { LineList } from './line-list';
import { OptionsPanel } from './options-panel';
import { TransportControls } from './transport-controls';

@Component({
  selector: 'main[appPractice]',
  imports: [TransportControls, OptionsPanel, BannerView, LineList],
  templateUrl: './practice.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Practice {
  protected readonly optionsOpen = signal(false);
}
