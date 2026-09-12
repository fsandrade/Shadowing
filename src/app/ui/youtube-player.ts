import { ChangeDetectionStrategy, Component, ElementRef, inject } from '@angular/core';
import { YoutubePlayerService } from '../platform/youtube-player';
import { YoutubeTopicStore } from '../state/youtube-topic-store';

@Component({
  selector: 'div[appYoutubePlayer]',
  host: { class: 'youtube-player' },
  templateUrl: './youtube-player.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class YoutubePlayer {
  private readonly players = inject(YoutubePlayerService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor() {
    const videoId = inject(YoutubeTopicStore).videoId();
    if (videoId) { this.players.attach(this.host.nativeElement, videoId); }
  }
}
