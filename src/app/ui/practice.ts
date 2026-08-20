import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { PracticeStore } from '../state/practice-store';
import { BannerView } from './banner-view';
import { CustomTopic } from './custom-topic';
import { LineList } from './line-list';
import { TransportControls } from './transport-controls';

@Component({
  selector: 'main[appPractice]',
  imports: [TransportControls, BannerView, CustomTopic, LineList],
  templateUrl: './practice.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Practice {
  protected readonly practice = inject(PracticeStore);
}
