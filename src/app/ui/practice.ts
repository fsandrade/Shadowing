import { ChangeDetectionStrategy, Component } from '@angular/core';
import { BannerView } from './banner-view';
import { LineList } from './line-list';
import { SettingsSliders } from './settings-sliders';
import { TransportControls } from './transport-controls';

@Component({
  selector: 'main[appPractice]',
  imports: [TransportControls, SettingsSliders, BannerView, LineList],
  templateUrl: './practice.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Practice {}
