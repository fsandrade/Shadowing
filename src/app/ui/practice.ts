import { ChangeDetectionStrategy, Component } from '@angular/core';
import { BannerView } from './banner-view';
import { LineList } from './line-list';
import { SettingsSliders } from './settings-sliders';
import { TransportControls } from './transport-controls';

/**
 * The practice column. Declared on <main> so its own grid rows (controls,
 * banner, lines) stay direct children, as `main { grid-template-rows }` needs.
 * `.controls` is a plain wrapper and gets no component of its own.
 */
@Component({
  selector: 'main[appPractice]',
  imports: [TransportControls, SettingsSliders, BannerView, LineList],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="controls">
      <div appTransportControls></div>
      <div appSettingsSliders></div>
    </div>
    <div appBanner></div>
    <div appLineList></div>
  `,
})
export class Practice {}
