import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { PracticeStore } from '../state/practice-store';
import { CustomTopic } from './custom-topic';
import { LineList } from './line-list';
import { TransportControls } from './transport-controls';
import { YoutubePlayer } from './youtube-player';

@Component({
  selector: 'main[appPractice]',
  imports: [TransportControls, CustomTopic, LineList, YoutubePlayer],
  templateUrl: './practice.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Practice {
  protected readonly practice = inject(PracticeStore);
}
