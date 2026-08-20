import {
  ChangeDetectionStrategy, Component, computed, inject, input, output,
} from '@angular/core';
import { pacingFor } from '../core/pacing';
import { PlaybackService } from '../playback/playback-service';
import { PracticeStore } from '../state/practice-store';
import { SessionTimerStore } from '../state/session-timer-store';
import { SettingsStore } from '../state/settings-store';
import { SettingsSliders } from './settings-sliders';

interface DurationOption {
  readonly min: number;
  readonly label: string;
  readonly title: string;
}

const DURATIONS: readonly DurationOption[] = [
  { min: 5, label: '5 min', title: 'Set a 5-minute session' },
  { min: 10, label: '10 min', title: 'Set a 10-minute session' },
  { min: 15, label: '15 min', title: 'Set a 15-minute session' },
];

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
  private readonly timer = inject(SessionTimerStore);
  private readonly playback = inject(PlaybackService);

  readonly open = input(false);
  readonly close = output<void>();

  protected readonly DURATIONS = DURATIONS;
  protected readonly BLUR_TITLE = BLUR_TITLE;
  protected readonly REPEAT_TITLE = REPEAT_TITLE;

  protected readonly atLevelPacing = computed(() => {
    const pacing = pacingFor(this.practice.level());
    return this.settings.rate() === pacing.rate && this.settings.slack() === pacing.slack;
  });

  protected pickDuration(min: number): void {
    this.playback.stop();
    this.settings.setDurationMin(min);
    this.timer.reset(min);
  }

  protected resetPacing(): void {
    const pacing = pacingFor(this.practice.level());
    this.settings.setRate(pacing.rate);
    this.settings.setSlack(pacing.slack);
  }

  protected shuffle(): void {
    this.playback.shuffle();
  }
}
