import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { PlaybackService } from '../playback/playback-service';
import { Speaker } from '../platform/speaker';
import { FlowStore } from '../state/flow-store';
import { PracticeStore } from '../state/practice-store';
import { VoiceStore } from '../state/voice-store';
import { CheckModeControl } from './check-mode';

const PLAY_TITLE = 'Auto Play/Pause (space) · Repeat current sentence (←)';

@Component({
  selector: 'div[appTransportControls]',
  imports: [CheckModeControl],
  host: { class: 'transport' },
  templateUrl: './transport-controls.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TransportControls {
  protected readonly playback = inject(PlaybackService);
  protected readonly practice = inject(PracticeStore);
  protected readonly flow = inject(FlowStore);
  private readonly voices = inject(VoiceStore);
  private readonly speaker = inject(Speaker);

  protected readonly PLAY_TITLE = PLAY_TITLE;

  protected readonly enabled = computed(
    () => this.practice.hasLines() && this.speaker.supported && this.voices.hasEnglish(),
  );

  protected readonly playLabel = computed(
    () => (this.practice.playing() ? '⏸ Pause' : '▶ Auto Play'),
  );

  // The check mode belongs to the activity everywhere except My text, where
  // the learner's own content means the choice is genuinely theirs.
  protected readonly customActivity = computed(() => this.flow.activity()?.id === 'custom');
}
