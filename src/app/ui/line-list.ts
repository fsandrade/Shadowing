import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { PlaybackService } from '../playback/playback-service';
import { PracticeStore } from '../state/practice-store';
import { SettingsStore } from '../state/settings-store';
import { ValidationService } from '../validation/validation-service';
import { ProgressRing } from './progress-ring';
import { ValidateBox } from './validate-box';

/**
 * The scrolling sentence list. Declared on <div> with the `lines` class and id
 * so `main`'s grid row 3 and every `.lines p ...` selector still apply.
 * Every line is rendered — no virtual scrolling — matching the vanilla app.
 *
 * The template is written without whitespace between the spans on purpose: the
 * stylesheet gives `.num` a fixed width and margin, and stray text nodes would
 * shift the sentence.
 */
@Component({
  selector: 'div[appLineList]',
  imports: [ProgressRing, ValidateBox],
  host: {
    class: 'lines',
    id: 'lines',
    '[class.blurred]': 'settings.blur()',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (line of practice.lines(); track $index) {
      <p
        [class.current]="$index === practice.index()"
        [class.spoken]="practice.spoken().has($index)"
        (click)="playback.playLine($index)"
      ><span class="num">{{ $index + 1 }}</span><span
          class="text"
          [innerHTML]="line"
        ></span>@if ($index === practice.index() && playback.inGap()) {<svg
          appProgressRing
          [progress]="playback.progress()"
        ></svg>}</p>
      @if ($index === validation.lineIndex()) {
        <div appValidateBox></div>
      }
    }
  `,
})
export class LineList {
  protected readonly practice = inject(PracticeStore);
  protected readonly settings = inject(SettingsStore);
  protected readonly playback = inject(PlaybackService);
  protected readonly validation = inject(ValidationService);
}
