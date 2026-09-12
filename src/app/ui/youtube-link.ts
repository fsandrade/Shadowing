import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { YoutubeSourceService } from '../data/youtube-source-service';
import { YoutubeTopicStore } from '../state/youtube-topic-store';

@Component({
  selector: 'div[appYoutubeLink]',
  host: { class: 'youtube-link' },
  templateUrl: './youtube-link.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class YoutubeLink {
  private readonly source = inject(YoutubeSourceService);
  protected readonly store = inject(YoutubeTopicStore);
  protected readonly link = signal('');
  protected readonly busy = signal(false);
  protected readonly error = signal('');

  protected async load(): Promise<void> {
    this.error.set('');
    this.busy.set(true);
    try {
      // load() rejects with a user-facing message on a bad link or a video
      // with no usable captions, so nothing to check on success.
      await this.source.load(this.link());
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'Could not load the subtitles.');
    } finally {
      this.busy.set(false);
    }
  }
}