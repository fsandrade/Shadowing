import { Directive, inject, input, output } from '@angular/core';
import { PlaybackService } from '../playback/playback-service';
import { Clock } from '../platform/clock';
import { PracticeStore } from '../state/practice-store';

/** Two ArrowLefts inside this window step back a line; a single one replays. */
const DOUBLE_PRESS_MS = 500;

/**
 * The keyboard map. Guard order is preserved from the pre-migration vanilla
 * handler and is load-bearing — see the comments inline.
 */
@Directive({
  selector: '[appShortcuts]',
  host: {
    '(document:keydown)': 'onKeydown($event)',
    // Drops focus from any clicked button so the focus ring does not stick. It
    // also stops a focused Play button from swallowing the next space press,
    // which would toggle playback twice.
    '(document:click)': 'blurClickedButton($event)',
  },
})
export class Shortcuts {
  /** False when the transport is dead (no audio, no lines). */
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

    // Any other key breaks a pending double-press.
    if (e.key !== 'ArrowLeft') { this.lastLeftAt = 0; }

    // Bails before the Escape branch, exactly as the vanilla handler did: with
    // the transport dead, Escape does not close the modal either.
    if (!this.enabled()) { return; }

    if (e.key === 'Escape' && this.helpOpen()) {
      e.preventDefault();
      this.closeHelp.emit();
      return;
    }

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

  /**
   * First press replays the current line from the start; a second press inside
   * the window steps back one line first.
   */
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
