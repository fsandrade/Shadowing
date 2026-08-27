import { computed, inject, Injectable, InjectionToken, signal } from '@angular/core';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { SUPABASE } from './supabase-client';

export const INITIAL_USER = new InjectionToken<User | null>('INITIAL_USER');

export async function ensureUser(client: SupabaseClient): Promise<User | null> {
  try {
    const { data: { session } } = await client.auth.getSession();
    if (session?.user) { return session.user; }

    const { data, error } = await client.auth.signInAnonymously();
    if (error) {
      console.warn(`Progress will not be saved: ${error.message}`);
      return null;
    }
    return data.user ?? null;
  } catch (reason) {
    console.warn('Progress will not be saved:', reason);
    return null;
  }
}

@Injectable({ providedIn: 'root' })
export class AuthStore {
  private readonly client = inject(SUPABASE);

  readonly user = signal<User | null>(inject(INITIAL_USER));

  readonly userId = computed(() => this.user()?.id ?? null);

  readonly tracking = computed(() => this.userId() !== null);

  readonly isAnonymous = computed(() => this.user()?.is_anonymous === true);

  readonly registered = computed(() => this.user() !== null && !this.isAnonymous());

  readonly email = computed(() => this.user()?.email ?? '');

  readonly displayName = computed(() => {
    const meta = this.user()?.user_metadata ?? {};
    const named = (meta['full_name'] ?? meta['name']) as string | undefined;
    return named || this.email() || '';
  });

  readonly initial = computed(() => {
    const name = this.displayName().trim();
    return name ? name[0]!.toUpperCase() : '?';
  });

  watch(): void {
    this.client.auth.onAuthStateChange((_event, session) => {
      this.user.set(session?.user ?? null);
    });
  }

  async signIn(): Promise<void> {
    const redirectTo = document.baseURI;

    if (this.isAnonymous()) {
      const { error } = await this.client.auth.linkIdentity({
        provider: 'google',
        options: { redirectTo },
      });
      if (!error) { return; }
    }

    await this.client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } });
  }

  async signOut(): Promise<void> {
    await this.client.auth.signOut();
    location.reload();
  }
}
