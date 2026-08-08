import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { SettingsStore } from '../state/settings-store';
import { VoiceStore } from '../state/voice-store';

/** Speed, gap and voice. Titles are verbatim from the vanilla index.html. */
@Component({
  selector: 'div[appSettingsSliders]',
  host: { class: 'sliders' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <label title="Speech speed: slower to catch every word, faster for a challenge">speed
      <input type="range" id="rate" min="0.2" max="2" step="0.1"
        [value]="settings.rate()"
        (input)="settings.setRate(+$any($event.target).value)">
      <output id="rateOut">{{ rateText() }}</output>
    </label>
    <label title="Gap between sentences: how long you have to repeat aloud">gap
      <input type="range" id="slack" min="0" max="3" step="0.1"
        [value]="settings.slack()"
        (input)="settings.setSlack(+$any($event.target).value)">
      <output id="slackOut">{{ slackText() }}</output>
    </label>
    <label title="Voice used to read the sentences">voice
      <select id="voice" [value]="selectedName()"
        (change)="settings.setVoiceName($any($event.target).value)">
        @for (v of voices.englishVoices(); track v.name) {
          <option [value]="v.name">{{ v.name }} ({{ v.lang }})</option>
        }
      </select>
    </label>
  `,
})
export class SettingsSliders {
  protected readonly settings = inject(SettingsStore);
  protected readonly voices = inject(VoiceStore);

  protected readonly rateText = computed(() => `${this.settings.rate().toFixed(2)}×`);
  protected readonly slackText = computed(() => `${this.settings.slack().toFixed(2)}×`);

  /** Falls back to whatever pickVoice resolved, so the select is never blank. */
  protected readonly selectedName = computed(
    () => this.settings.voiceName() || this.voices.selected()?.name || '',
  );
}
