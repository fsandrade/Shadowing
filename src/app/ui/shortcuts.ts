import { Directive, inject, input, output } from '@angular/core';
import { PlaybackService } from '../playback/playback-service';
import { Clock } from '../platform/clock';
import { PracticeStore } from '../state/practice-store';

const DOUBLE_PRESS_MS = 500;

@Directive({
  selector: '[appShortcuts]',
  host: {
    '(document:keydown)': 'onKeydown($event)',
    '(document:click)': 'blurClickedButton($event)',
  },
})
export class Shortcuts {
  readonly enabled = input(true);
  readonly helpOpen = input(false);
  readonly closeHelp = output<void>();

  private readonly playback = inject(PlaybackService);
  private readonly practice = inject(PracticeStore);
  private readonly clock = inject(Clock);

  private lastLeftAt = 0;

  protected onKeydown(e: KeyboardEvent): void {
    const target = e.target as HTMLElement | null;
    if (target && /^(INPUT|SELECT|TEXTAREA)$/.test(target.tagName)) { return; }
    if (e.altKey || e.ctrlKey || e.metaKey || e.repeat) { return; }

    if (e.key !== 'ArrowLeft') { this.lastLeftAt = 0; }

    // Above the enabled() guard on purpose: the practice shortcuts are off
    // everywhere but the practice screen, and the help modal opens from all of
    // them. Escape has to close it wherever it was opened.
    if (e.key === 'Escape' && this.helpOpen()) {
      e.preventDefault();
      this.closeHelp.emit();
      return;
    }

    if (!this.enabled()) { return; }

    if (e.key === ' ') {
      e.preventDefault();
      this.playback.toggle();
      return;
    }

    if (e.key === 'ArrowRight') {
      e.preventDefault();
      this.playback.next();
      return;
    }

    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      this.onArrowLeft();
    }
  }

  private onArrowLeft(): void {
    const now = this.clock.now();
    if (this.practice.index() > 0 && now - this.lastLeftAt <= DOUBLE_PRESS_MS) {
      this.practice.back();
      this.lastLeftAt = 0;
    } else {
      this.lastLeftAt = now;
    }
    this.playback.play();
  }

  protected blurClickedButton(e: MouseEvent): void {
    const target = e.target as HTMLElement | null;
    target?.closest?.('button')?.blur();
  }
}
