import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { AppStartup } from './app-startup';
import { Speaker } from './platform/speaker';
import { PracticeStore } from './state/practice-store';
import { VoiceStore } from './state/voice-store';
import { HeaderBar } from './ui/header-bar';
import { Practice } from './ui/practice';
import { Shortcuts } from './ui/shortcuts';
import { TopicList } from './ui/topic-list';

/**
 * The shell. Every child uses an attribute selector so the emitted tree matches
 * the vanilla app's: body's two grid rows are <header> and .app, and .app's two
 * columns are aside.sidebar and main.
 */
@Component({
  selector: 'app-root',
  imports: [HeaderBar, TopicList, Practice, Shortcuts],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header appHeaderBar (help)="helpOpen.set(true)"></header>
    <div class="app" appShortcuts
      [enabled]="enabled()"
      [helpOpen]="helpOpen()"
      (closeHelp)="helpOpen.set(false)">
      <aside appTopicList></aside>
      <main appPractice></main>
    </div>
  `,
})
export class App {
  private readonly practice = inject(PracticeStore);
  private readonly voices = inject(VoiceStore);
  private readonly speaker = inject(Speaker);

  protected readonly helpOpen = signal(false);

  /** Mirrors TransportControls.enabled — the shortcuts follow the buttons. */
  protected readonly enabled = computed(
    () => this.practice.hasLines() && this.speaker.supported && this.voices.hasEnglish(),
  );

  constructor() {
    inject(AppStartup).run();
  }
}
