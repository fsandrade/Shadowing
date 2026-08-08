import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Placeholder shell. The real component tree is assembled in Part 2 of the
 * migration; for now this only proves the toolchain boots.
 */
@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<h1>Shadowing</h1>`,
})
export class App {}
