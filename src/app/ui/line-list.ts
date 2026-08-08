import {
  afterRenderEffect, ChangeDetectionStrategy, Component, ElementRef, inject, untracked,
} from '@angular/core';
import { PlaybackService } from '../playback/playback-service';
import { PracticeStore } from '../state/practice-store';
import { SettingsStore } from '../state/settings-store';
import { ValidationService } from '../validation/validation-service';
import { ProgressRing } from './progress-ring';
import { ValidateBox } from './validate-box';

@Component({
  selector: 'div[appLineList]',
  imports: [ProgressRing, ValidateBox],
  host: {
    class: 'lines',
    id: 'lines',
    '[class.blurred]': 'settings.blur()',
  },
  templateUrl: './line-list.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LineList {
  protected readonly practice = inject(PracticeStore);
  protected readonly settings = inject(SettingsStore);
  protected readonly playback = inject(PlaybackService);
  protected readonly validation = inject(ValidationService);

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor() {
    afterRenderEffect(() => {
      this.practice.index();
      untracked(() => this.revealCurrentLine());
    });
  }

  private revealCurrentLine(): void {
    this.host.nativeElement
      .querySelector('p.current')
      ?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }
}
