import {
  ChangeDetectionStrategy, Component, computed, inject, input, output,
} from '@angular/core';
import { FlowStore } from '../state/flow-store';
import { SessionTimerStore } from '../state/session-timer-store';
import { SettingsStore } from '../state/settings-store';

@Component({
  selector: 'header[appHeaderBar]',
  imports: [],
  templateUrl: './header-bar.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeaderBar {
  protected readonly timer = inject(SessionTimerStore);
  private readonly flow = inject(FlowStore);
  private readonly settings = inject(SettingsStore);

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
