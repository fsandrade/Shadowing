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
    '(keydown)': 'keepFocus($event)',
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

  protected keepFocus(event: Event): void {
    const e = event as KeyboardEvent;
    if (e.key !== 'Tab') { return; }

    const focusable = [...this.host.nativeElement.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    )];
    if (!focusable.length) { return; }

    const first = focusable[0]!;
    const last = focusable[focusable.length - 1]!;
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
}
