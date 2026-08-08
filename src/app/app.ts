import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AppStartup } from './app-startup';
import { HeaderBar } from './ui/header-bar';
import { Practice } from './ui/practice';
import { TopicList } from './ui/topic-list';

/**
 * The shell. Every child uses an attribute selector so the emitted tree matches
 * the vanilla app's: body's two grid rows are <header> and .app, and .app's two
 * columns are aside.sidebar and main.
 */
@Component({
  selector: 'app-root',
  imports: [HeaderBar, TopicList, Practice],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header appHeaderBar></header>
    <div class="app">
      <aside appTopicList></aside>
      <main appPractice></main>
    </div>
  `,
})
export class App {
  constructor() {
    inject(AppStartup).run();
  }
}
