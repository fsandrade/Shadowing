import { ChangeDetectionStrategy, Component } from '@angular/core';
import { LineList } from './line-list';

/**
 * The practice column. Declared on <main> so its own grid rows (controls,
 * banner, lines) stay direct children, as `main { grid-template-rows }` needs.
 * `.controls` is a plain wrapper and gets no component of its own.
 */
@Component({
  selector: 'main[appPractice]',
  imports: [LineList],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="controls"></div>
    <div appLineList></div>
  `,
})
export class Practice {}
