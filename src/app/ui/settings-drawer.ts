import {
  ChangeDetectionStrategy, Component, computed, inject, input, output,
} from '@angular/core';
import { SettingsStore } from '../state/settings-store';
import { SettingsSliders } from './settings-sliders';

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

  readonly open = input(false);
  readonly close = output<void>();

  protected readonly atPlaybackDefaults = computed(
    () => this.settings.rate() === 1 && this.settings.slack() === 1,
  );

  protected resetPlayback(): void {
    this.settings.setRate(1);
    this.settings.setSlack(1);
  }
}
