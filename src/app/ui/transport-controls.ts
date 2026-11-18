import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { PlaybackService } from '../playback/playback-service';
import { Speaker } from '../platform/speaker';
import { FlowStore } from '../state/flow-store';
import { PracticeStore } from '../state/practice-store';
import { VoiceStore } from '../state/voice-store';

const PLAY_TITLE = 'Auto Play/Pause (space) · Repeat current sentence (left arrow)';

@Component({
  selector: 'div[appTransportControls]',
  host: { class: 'transport' },
  templateUrl: './transport-controls.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TransportControls {
  protected readonly playback = inject(PlaybackService);
  protected readonly practice = inject(PracticeStore);
  private readonly flow = inject(FlowStore);
  private readonly voices = inject(VoiceStore);
  private readonly speaker = inject(Speaker);

  protected readonly PLAY_TITLE = PLAY_TITLE;

  protected readonly enabled = computed(
    () => this.practice.hasLines() && this.speaker.supported && this.voices.hasEnglish(),
  );

  protected readonly playLabel = computed(
    () => (this.practice.playing() ? 'Pause' : 'Auto Play'),
  );

  protected finish(): void {
    this.playback.stop();
    this.flow.finish();
  }
}
