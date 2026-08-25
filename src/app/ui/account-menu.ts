import {
  ChangeDetectionStrategy, Component, computed, ElementRef, inject, output, signal,
} from '@angular/core';
import { AuthStore } from '../platform/auth';

@Component({
  selector: 'div[appAccountMenu]',
  host: {
    class: 'account',
    '(document:click)': 'onDocumentClick($event)',
    '(keydown.escape)': 'open.set(false)',
  },
  templateUrl: './account-menu.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountMenu {
  private readonly host = inject(ElementRef<HTMLElement>);
  protected readonly auth = inject(AuthStore);

  readonly openSettings = output<void>();

  protected readonly open = signal(false);

  protected readonly label = computed(
    () => (this.auth.isAnonymous() ? 'Save my progress' : 'Sign in'),
  );

  protected readonly hint = computed(() => (this.auth.isAnonymous()
    ? 'Create an account with Google so this progress is not lost'
    : 'Sign in with Google'));

  protected toggle(): void {
    this.open.update((v) => !v);
  }

  protected signIn(): void {
    void this.auth.signIn();
  }

  protected signOut(): void {
    this.open.set(false);
    void this.auth.signOut();
  }

  protected showSettings(): void {
    this.open.set(false);
    this.openSettings.emit();
  }

  protected onDocumentClick(event: Event): void {
    if (!this.open()) { return; }
    const el = this.host.nativeElement as HTMLElement;
    if (!el.contains(event.target as Node)) { this.open.set(false); }
  }
}
