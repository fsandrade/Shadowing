import {
  ChangeDetectionStrategy, Component, computed, inject, input, output,
} from '@angular/core';
import { FlowStore } from '../state/flow-store';
import { ProfileStore } from '../state/profile-store';
import { AccountMenu } from './account-menu';
import { SessionTimerStore } from '../state/session-timer-store';
import { SettingsStore } from '../state/settings-store';

@Component({
  selector: 'header[appHeaderBar]',
  imports: [AccountMenu],
  templateUrl: './header-bar.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeaderBar {
  protected readonly timer = inject(SessionTimerStore);
  protected readonly profile = inject(ProfileStore);
  private readonly flow = inject(FlowStore);
  private readonly settings = inject(SettingsStore);

  // Only a running activity has time left in it. On the chooser the clock
  // showed a full duration for a session nobody had started, and on the
  // summary finish() has already put a fresh duration back on it - so it told
  // the learner they had 15:00 left in the session they had just ended.
  protected readonly practising = computed(() => this.flow.screen() === 'practice');

  readonly settingsOpen = input(false);

  readonly help = output<void>();
  readonly toggleSettings = output<void>();

  protected readonly clockTitle = computed(() => {
    const minutes = this.settings.durationMin();
    return minutes === 0
      ? 'Time spent practising'
      : `Time left in this ${minutes}-minute session`;
  });
}
