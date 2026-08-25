import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { SettingsStore } from '../state/settings-store';
import { VoiceStore } from '../state/voice-store';

@Component({
  selector: 'div[appSettingsSliders]',
  host: { class: 'sliders' },
  templateUrl: './settings-sliders.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsSliders {
  protected readonly settings = inject(SettingsStore);
  protected readonly voices = inject(VoiceStore);

  protected readonly rateText = computed(() => `${this.settings.rate().toFixed(2)}×`);
  protected readonly slackText = computed(() => `${this.settings.slack().toFixed(2)}×`);

  protected readonly selectedName = computed(
    () => this.settings.voiceName() || this.voices.selected()?.name || '',
  );
}
