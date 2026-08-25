import {
  ChangeDetectionStrategy, Component, computed, inject, input, output,
} from '@angular/core';
import { countAt } from '../core/catalog';
import { pacingFor } from '../core/pacing';
import { CATALOG } from '../state/catalog-token';
import { ProfileStore } from '../state/profile-store';
import { PracticeStore } from '../state/practice-store';
import { SettingsStore } from '../state/settings-store';
import { SettingsSliders } from './settings-sliders';

const BLUR_TITLE = 'Hide the text so you practise by ear';

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
  protected readonly profile = inject(ProfileStore);
  private readonly catalog = inject(CATALOG);

  readonly open = input(false);
  readonly close = output<void>();

  protected readonly BLUR_TITLE = BLUR_TITLE;

  protected readonly levels = computed(() => this.catalog.levels.map((level) => ({
    id: level.id,
    description: level.description,
    available: countAt(this.catalog, level.id) > 0,
  })));

  protected pickLevel(id: string, available: boolean): void {
    if (!available) { return; }
    this.profile.setLevel(id);
  }

  protected readonly atLevelPacing = computed(() => {
    const pacing = pacingFor(this.practice.level());
    return this.settings.rate() === pacing.rate && this.settings.slack() === pacing.slack;
  });

  protected resetPacing(): void {
    const pacing = pacingFor(this.practice.level());
    this.settings.setRate(pacing.rate);
    this.settings.setSlack(pacing.slack);
  }
}
