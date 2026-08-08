import {
  ChangeDetectionStrategy, Component, effect, ElementRef, inject, input, output,
} from '@angular/core';

/** Body copy is verbatim from the vanilla index.html. */
@Component({
  selector: 'div[appHelpModal]',
  host: {
    class: 'modal',
    id: 'helpModal',
    role: 'dialog',
    'aria-modal': 'true',
    'aria-labelledby': 'helpTitle',
    '[class.show]': 'open()',
    '(click)': 'onBackdropClick($event)',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="modal-panel">
      <div class="modal-head">
        <h2 id="helpTitle">How to use this app</h2>
        <button type="button" class="modal-close" id="helpClose"
          aria-label="Close help" title="Close" (click)="close.emit()">&times;</button>
      </div>
      <div class="modal-body">
        <p>Shadowing is the simplest way to learn English chunks: pick a topic, listen to each sentence, and repeat it aloud in the pause after it.</p>
        <ol>
          <li>Choose a <b>Topic</b> on the left.</li>
          <li>Press <b>Play</b> and repeat every sentence aloud during the gap.</li>
          <li>Tune <b>speed</b>, <b>gap</b> and <b>voice</b> to your level.</li>
        </ol>
        <h3>What each feature is for</h3>
        <ul>
          <li><b>Play / Pause</b> (space) &mdash; start and stop the exercise. When paused, <b>&larr;</b> repeats the current sentence from the start.</li>
          <li><b>Next</b> (&rarr;) &mdash; jump ahead whenever you want.</li>
          <li><b>Shuffle</b> &mdash; randomize the order so you practice without memorizing the sequence.</li>
          <li><b>Session</b> (5/10/15 min) &mdash; set a daily goal; the app tracks your time and counts the sentences you practiced.</li>
          <li><b>speed</b> &mdash; slow it down to catch every sound, or speed it up when you feel ready.</li>
          <li><b>gap</b> &mdash; the pause between sentences is your time to repeat; make it longer when you need more time.</li>
          <li><b>voice</b> &mdash; pick the English voice that is easiest to understand (Microsoft Edge has the best selection).</li>
          <li><b>Blur</b> &mdash; hide the sentences while you practice, to build listening memory; already-practiced lines reappear so you can check yourself.</li>
        </ul>
      </div>
    </div>
  `,
})
export class HelpModal {
  readonly open = input(false);
  readonly close = output<void>();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private previousFocus: HTMLElement | null = null;

  constructor() {
    // Focus the close button on open and restore the prior focus on dismiss.
    effect(() => {
      if (this.open()) {
        this.previousFocus = document.activeElement as HTMLElement | null;
        this.host.nativeElement
          .querySelector<HTMLButtonElement>('#helpClose')?.focus();
      } else {
        this.previousFocus?.focus?.();
        this.previousFocus = null;
      }
    });
  }

  /** Only a click on the backdrop itself dismisses; clicks in the panel do not. */
  protected onBackdropClick(e: MouseEvent): void {
    if (e.target === this.host.nativeElement) { this.close.emit(); }
  }
}
