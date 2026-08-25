import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { PlaybackService } from '../playback/playback-service';
import { Speaker } from '../platform/speaker';
import { FlowStore } from '../state/flow-store';
import { PracticeStore } from '../state/practice-store';
import { SettingsStore } from '../state/settings-store';
import { VoiceStore } from '../state/voice-store';
import { CheckModeControl } from './check-mode';

const PLAY_TITLE = 'Auto Play/Pause (space) · Repeat current sentence (←)';
const REPEAT_TITLE = 'Repeat a sentence until you score five stars';

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
  private readonly flow = inject(FlowStore);
  private readonly voices = inject(VoiceStore);
  private readonly speaker = inject(Speaker);

  protected readonly settings = inject(SettingsStore);

  protected readonly PLAY_TITLE = PLAY_TITLE;
  protected readonly REPEAT_TITLE = REPEAT_TITLE;

  protected readonly enabled = computed(
    () => this.practice.hasLines() && this.speaker.supported && this.voices.hasEnglish(),
  );

  protected readonly playLabel = computed(
    () => (this.practice.playing() ? '⏸ Pause' : '▶ Auto Play'),
  );

  // The check mode belongs to the activity everywhere except My text, where
  // the learner's own content means the choice is genuinely theirs.
  protected readonly customActivity = computed(() => this.flow.activity()?.id === 'custom');

  // FlowStore.finish() does not know about playback, and the timer it resets
  // puts a full duration back on the clock - so the expiry checkpoint would
  // not catch a loop left running for another whole session. Stop first, the
  // same order finishIfExpired() uses.
  protected finish(): void {
    this.playback.stop();
    this.flow.finish();
  }
}
