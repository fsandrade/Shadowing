import {
  ChangeDetectionStrategy, Component, computed, inject, input, output,
} from '@angular/core';
import { pacingFor } from '../core/pacing';
import { PlaybackService } from '../playback/playback-service';
import { PracticeStore } from '../state/practice-store';
import { SettingsStore } from '../state/settings-store';
import { SettingsSliders } from './settings-sliders';

const BLUR_TITLE = 'Hide the text so you practise by ear';
const REPEAT_TITLE = 'Repeat a sentence until you score five stars';

@Component({
  selector: 'div[appSettingsDrawer]',
  imports: [SettingsSliders],
  host: {
    class: 'settings-drawer',
    id: 'settingsDrawer',
    role: 'dialog',
    'aria-label': 'Settings',
    '[class.open]': 'open()',
    '[attr.aria-hidden]': '!open()',
    '[attr.inert]': 'open() ? null : ""',
  },
  templateUrl: './settings-drawer.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsDrawer {
  protected readonly settings = inject(SettingsStore);
  protected readonly practice = inject(PracticeStore);
  private readonly playback = inject(PlaybackService);

  readonly open = input(false);
  readonly close = output<void>();

  protected readonly BLUR_TITLE = BLUR_TITLE;
  protected readonly REPEAT_TITLE = REPEAT_TITLE;

  protected readonly atLevelPacing = computed(() => {
    const pacing = pacingFor(this.practice.level());
    return this.settings.rate() === pacing.rate && this.settings.slack() === pacing.slack;
  });

  protected resetPacing(): void {
    const pacing = pacingFor(this.practice.level());
    this.settings.setRate(pacing.rate);
    this.settings.setSlack(pacing.slack);
  }

  protected shuffle(): void {
    this.playback.shuffle();
  }
}
