import { computed, inject, Injectable, signal } from '@angular/core';

export const NO_USER = null;




@Injectable({ providedIn: 'root' })
export class AuthStore {
  readonly user = signal<null>(null);
  readonly userId = computed(() => null);
  readonly tracking = computed(() => false);
  readonly isAnonymous = computed(() => false);
  readonly registered = computed(() => false);
  readonly email = computed(() => '');
  readonly displayName = computed(() => '');
  readonly initial = computed(() => '?');

  watch(): void {
    
  }

  async signIn(): Promise<void> {
    
  }

  async signOut(): Promise<void> {
    
  }
}
