import {
  ChangeDetectionStrategy, Component, effect, ElementRef, inject, input, output,
} from '@angular/core';

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
  templateUrl: './help-modal.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HelpModal {
  readonly open = input(false);
  readonly close = output<void>();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private previousFocus: HTMLElement | null = null;

  constructor() {
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

  protected onBackdropClick(e: MouseEvent): void {
    if (e.target === this.host.nativeElement) { this.close.emit(); }
  }
}
