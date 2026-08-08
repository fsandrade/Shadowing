import { ChangeDetectionStrategy, Component, inject, output } from '@angular/core';
import { SessionTimerStore } from '../state/session-timer-store';
import { DurationPicker } from './duration-picker';

@Component({
  selector: 'header[appHeaderBar]',
  imports: [DurationPicker],
  templateUrl: './header-bar.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeaderBar {
  protected readonly timer = inject(SessionTimerStore);
  readonly help = output<void>();
}
