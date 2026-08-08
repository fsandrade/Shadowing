import { ChangeDetectionStrategy, Component, inject, output } from '@angular/core';
import { SessionTimerStore } from '../state/session-timer-store';
import { DurationPicker } from './duration-picker';

/** The top bar: title, session buttons, clock, help. Declared on <header>. */
@Component({
  selector: 'header[appHeaderBar]',
  imports: [DurationPicker],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>Shadowing</h1>
    <div appDurationPicker></div>
    <div class="clock" id="clock">{{ timer.clockText() }}</div>
    <button
      type="button"
      class="help-btn"
      id="help"
      aria-label="How to use this app"
      title="How to use this app"
      (click)="help.emit()"
    >?</button>
  `,
})
export class HeaderBar {
  protected readonly timer = inject(SessionTimerStore);
  readonly help = output<void>();
}
