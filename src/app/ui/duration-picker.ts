import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { PlaybackService } from '../playback/playback-service';
import { SessionTimerStore } from '../state/session-timer-store';
import { SettingsStore } from '../state/settings-store';

interface DurationOption {
  readonly min: number;
  readonly label: string;
  readonly title: string;
}

const OPTIONS: readonly DurationOption[] = [
  { min: 5, label: '5 min', title: 'Set a 5-minute session' },
  { min: 10, label: '10 min', title: 'Set a 10-minute session' },
  { min: 15, label: '15 min', title: 'Set a 15-minute session' },
  { min: 0, label: '∞', title: 'Practice with no time limit' },
];

@Component({
  selector: 'div[appDurationPicker]',
  host: { class: 'durations', id: 'durations' },
  templateUrl: './duration-picker.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DurationPicker {
  protected readonly settings = inject(SettingsStore);
  private readonly timer = inject(SessionTimerStore);
  private readonly playback = inject(PlaybackService);

  protected readonly OPTIONS = OPTIONS;

  protected pick(min: number): void {
    this.playback.stop();
    this.settings.setDurationMin(min);
    this.timer.reset(min);
  }
}
