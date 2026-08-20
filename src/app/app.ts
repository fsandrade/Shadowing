import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { AppStartup } from './app-startup';
import { Speaker } from './platform/speaker';
import { PracticeStore } from './state/practice-store';
import { VoiceStore } from './state/voice-store';
import { EdgeTip } from './ui/edge-tip';
import { HeaderBar } from './ui/header-bar';
import { HelpModal } from './ui/help-modal';
import { Practice } from './ui/practice';
import { SettingsDrawer } from './ui/settings-drawer';
import { Shortcuts } from './ui/shortcuts';
import { TopicList } from './ui/topic-list';

@Component({
  selector: 'app-root',
  imports: [
    HeaderBar, TopicList, Practice, Shortcuts, EdgeTip, HelpModal, SettingsDrawer,
  ],
  templateUrl: './app.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  protected readonly practice = inject(PracticeStore);
  private readonly voices = inject(VoiceStore);
  private readonly speaker = inject(Speaker);

  protected readonly helpOpen = signal(false);
  protected readonly settingsOpen = signal(false);

  protected readonly enabled = computed(
    () => this.practice.hasLines() && this.speaker.supported && this.voices.hasEnglish(),
  );

  constructor() {
    inject(AppStartup).run();
  }
}
