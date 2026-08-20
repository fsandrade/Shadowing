import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { AppStartup } from './app-startup';
import { Speaker } from './platform/speaker';
import { FlowStore } from './state/flow-store';
import { PracticeStore } from './state/practice-store';
import { VoiceStore } from './state/voice-store';
import { ActivityChooser } from './ui/activity-chooser';
import { BannerView } from './ui/banner-view';
import { EdgeTip } from './ui/edge-tip';
import { HeaderBar } from './ui/header-bar';
import { HelpModal } from './ui/help-modal';
import { LevelPicker } from './ui/level-picker';
import { Practice } from './ui/practice';
import { SessionSummary } from './ui/session-summary';
import { SettingsDrawer } from './ui/settings-drawer';
import { Shortcuts } from './ui/shortcuts';

@Component({
  selector: 'app-root',
  imports: [
    HeaderBar, BannerView, LevelPicker, ActivityChooser, Practice, SessionSummary, Shortcuts,
    EdgeTip, HelpModal, SettingsDrawer,
  ],
  templateUrl: './app.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  protected readonly flow = inject(FlowStore);
  private readonly practice = inject(PracticeStore);
  private readonly voices = inject(VoiceStore);
  private readonly speaker = inject(Speaker);

  protected readonly helpOpen = signal(false);
  protected readonly settingsOpen = signal(false);

  protected readonly enabled = computed(
    () => this.flow.screen() === 'practice'
      && this.practice.hasLines()
      && this.speaker.supported
      && this.voices.hasEnglish(),
  );

  constructor() {
    inject(AppStartup).run();
  }
}
