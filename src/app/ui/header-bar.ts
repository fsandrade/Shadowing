import {
  ChangeDetectionStrategy, Component, computed, inject, input, output,
} from '@angular/core';
import { PracticeStore } from '../state/practice-store';
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
  protected readonly practice = inject(PracticeStore);
  private readonly settings = inject(SettingsStore);

  readonly settingsOpen = input(false);

  readonly help = output<void>();
  readonly toggleSettings = output<void>();

  protected readonly clockTitle = computed(() => {
    const minutes = this.settings.durationMin();
    return minutes > 0
      ? `Time left in this ${minutes}-minute session`
      : 'Time spent practising';
  });
}
