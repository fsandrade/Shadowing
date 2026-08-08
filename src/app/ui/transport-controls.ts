import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { PlaybackService } from '../playback/playback-service';
import { SpeechRecognizer } from '../platform/speech-recognition';
import { Speaker } from '../platform/speaker';
import { PracticeStore } from '../state/practice-store';
import { SettingsStore } from '../state/settings-store';
import { VoiceStore } from '../state/voice-store';

const PLAY_TITLE = 'Play/Pause (space) · Repeat current sentence (←)';
const BLUR_TITLE = 'Blur the text to practice from memory (hover or playback reveals)';
const VALIDATE_TITLE = 'Speech validator: transcribe your repeat and rate it 0–5 stars';

@Component({
  selector: 'div[appTransportControls]',
  host: { class: 'transport' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button type="button" id="play" [disabled]="!enabled()"
      [title]="PLAY_TITLE" (click)="playback.toggle()">{{ playLabel() }}</button>
    <button type="button" id="next" [disabled]="!enabled()"
      title="Next (&rarr;)" (click)="playback.next()">&#9197;</button>
    <button type="button" id="shuffle" [disabled]="!enabled()"
      title="Shuffle the sentences randomly"
      (click)="playback.shuffle()">&#8644; shuffle</button>
    <button type="button" id="blur" [attr.aria-pressed]="settings.blur()"
      [title]="BLUR_TITLE"
      (click)="settings.setBlur(!settings.blur())">&#9682; blur</button>
    <button type="button" id="validate" [disabled]="!sttSupported"
      [attr.aria-pressed]="settings.sttEnabled()" [title]="VALIDATE_TITLE"
      (click)="settings.setSttEnabled(!settings.sttEnabled())">&#10003; validate</button>
  `,
})
export class TransportControls {
  protected readonly playback = inject(PlaybackService);
  protected readonly practice = inject(PracticeStore);
  protected readonly settings = inject(SettingsStore);
  private readonly voices = inject(VoiceStore);
  private readonly speaker = inject(Speaker);

  protected readonly PLAY_TITLE = PLAY_TITLE;
  protected readonly BLUR_TITLE = BLUR_TITLE;
  protected readonly VALIDATE_TITLE = VALIDATE_TITLE;

  protected readonly sttSupported = inject(SpeechRecognizer).supported();

  /**
   * Transport is dead without audio: no synthesis support, no English voice, or
   * nothing to practise. Blur and validate stay live, since they are text-only.
   */
  protected readonly enabled = computed(
    () => this.practice.hasLines() && this.speaker.supported && this.voices.hasEnglish(),
  );

  protected readonly playLabel = computed(
    () => (this.practice.playing() ? '⏸ Pause' : '▶ Play'),
  );
}
