import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { PlaybackService } from '../playback/playback-service';
import { Speaker } from '../platform/speaker';
import { PracticeStore } from '../state/practice-store';
import { SettingsStore } from '../state/settings-store';
import { VoiceStore } from '../state/voice-store';
import { ValidationService } from '../validation/validation-service';
import { SettingsSliders } from './settings-sliders';

const BLUR_TITLE = 'Blur the text to practice from memory (hover or playback reveals)';
const REPEAT_TITLE =
  'Retry a sentence until you score 5 stars, up to five times. '
  + 'Needs rate me switched on.';
const TYPING_TITLE =
  'Type the sentence instead of saying it, and have your spelling scored. '
  + 'Scoring still comes from rate me, but typing needs no microphone. '
  + 'Turn on blur to practice it as dictation.';

@Component({
  selector: 'div[appOptionsPanel]',
  imports: [SettingsSliders],
  host: {
    class: 'options',
    id: 'optionsPanel',
    '[class.show]': 'open()',
  },
  templateUrl: './options-panel.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OptionsPanel {
  readonly open = input(false);

  protected readonly playback = inject(PlaybackService);
  protected readonly settings = inject(SettingsStore);
  private readonly practice = inject(PracticeStore);
  private readonly voices = inject(VoiceStore);
  private readonly speaker = inject(Speaker);
  private readonly validation = inject(ValidationService);

  protected readonly BLUR_TITLE = BLUR_TITLE;
  protected readonly REPEAT_TITLE = REPEAT_TITLE;
  protected readonly TYPING_TITLE = TYPING_TITLE;

  protected readonly enabled = computed(
    () => this.practice.hasLines() && this.speaker.supported && this.voices.hasEnglish(),
  );

  protected toggleTyping(): void {
    this.settings.setTypingMode(!this.settings.typingMode());
    this.validation.dispose();
  }
}
