import {
  ChangeDetectionStrategy, Component, computed, inject, input, output,
} from '@angular/core';
import { PlaybackService } from '../playback/playback-service';
import { SpeechRecognizer } from '../platform/speech-recognition';
import { Speaker } from '../platform/speaker';
import { PracticeStore } from '../state/practice-store';
import { SettingsStore } from '../state/settings-store';
import { VoiceStore } from '../state/voice-store';
import { ValidationService } from '../validation/validation-service';

const PLAY_TITLE = 'Auto Play/Pause (space) · Repeat current sentence (←)';
const RATE_TITLE = 'Rate me: transcribe your repeat and score it 0–5 stars';

@Component({
  selector: 'div[appTransportControls]',
  host: { class: 'transport' },
  templateUrl: './transport-controls.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TransportControls {
  readonly optionsOpen = input(false);
  readonly toggleOptions = output<void>();

  protected readonly playback = inject(PlaybackService);
  protected readonly practice = inject(PracticeStore);
  protected readonly settings = inject(SettingsStore);
  private readonly voices = inject(VoiceStore);
  private readonly speaker = inject(Speaker);
  private readonly validation = inject(ValidationService);

  protected readonly PLAY_TITLE = PLAY_TITLE;
  protected readonly RATE_TITLE = RATE_TITLE;

  protected readonly sttSupported = inject(SpeechRecognizer).supported();

  protected readonly enabled = computed(
    () => this.practice.hasLines() && this.speaker.supported && this.voices.hasEnglish(),
  );

  protected readonly playLabel = computed(
    () => (this.practice.playing() ? '⏸ Pause' : '▶ Auto Play'),
  );

  protected toggleValidate(): void {
    if (this.settings.sttEnabled()) {
      this.validation.disable();
    } else {
      void this.validation.enable();
    }
  }
}
