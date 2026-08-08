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

/** Session-length buttons. Choosing one stops playback and resets the tally. */
@Component({
  selector: 'div[appDurationPicker]',
  host: { class: 'durations', id: 'durations' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (opt of OPTIONS; track opt.min) {
      <button
        type="button"
        [attr.data-min]="opt.min"
        [title]="opt.title"
        [attr.aria-pressed]="settings.durationMin() === opt.min"
        (click)="pick(opt.min)"
      >{{ opt.label }}</button>
    }
  `,
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
