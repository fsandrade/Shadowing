import { computed, inject, Injectable, signal } from '@angular/core';
import { AuthStore } from '../platform/auth';
import { SafeStorage } from '../platform/storage';
import { SUPABASE } from '../platform/supabase-client';
import { SETTINGS_KEY } from './settings-store';

export const PROFILE_KEY = 'shadowing.profile';

interface StoredProfile {
  levelId?: unknown;
}

function levelOf(value: unknown): string | null {
  return typeof value === 'string' && value ? value : null;
}

// The learner's English level. Asked once, then it is theirs: user_settings is
// the source of truth and localStorage is a cache, so the app still opens on
// the right screen offline and for a user whose anonymous sign-in failed.
@Injectable({ providedIn: 'root' })
export class ProfileStore {
  private readonly storage = inject(SafeStorage);
  private readonly client = inject(SUPABASE);
  private readonly auth = inject(AuthStore);

  readonly levelId = signal<string | null>(this.adopt());

  readonly chosen = computed(() => this.levelId() !== null);

  setLevel(id: string): void {
    this.levelId.set(id);
    this.cache(id);
    void this.push(id);
  }

  clear(): void {
    this.levelId.set(null);
    this.cache(null);
  }

  async load(): Promise<void> {
    const userId = this.auth.userId();
    if (!userId) { return; }

    let remote: string | null = null;
    try {
      const { data, error } = await this.client
        .from('user_settings')
        .select('level_id')
        .eq('user_id', userId)
        .maybeSingle();
      if (error) { return; }
      remote = levelOf(data?.['level_id']);
    } catch {
      return;
    }

    if (remote) {
      this.levelId.set(remote);
      this.cache(remote);
      return;
    }

    // Nothing up there yet: this learner chose their level before they had an
    // account, or before this release existed. Send it up.
    const local = this.levelId();
    if (local) { void this.push(local); }
  }

  private adopt(): string | null {
    const own = levelOf(this.storage.read<StoredProfile>(PROFILE_KEY)?.levelId);
    if (own) { return own; }

    // Everyone practising today has a level inside the settings blob. Take it
    // so nobody who already answered is asked again - and write it into the
    // profile straight away, because SettingsStore stops persisting it.
    const legacy = levelOf(this.storage.read<StoredProfile>(SETTINGS_KEY)?.levelId);
    if (legacy) { this.cache(legacy); }
    return legacy;
  }

  private cache(levelId: string | null): void {
    this.storage.write(PROFILE_KEY, { levelId });
  }

  private async push(levelId: string): Promise<void> {
    const userId = this.auth.userId();
    if (!userId) { return; }
    try {
      await this.client
        .from('user_settings')
        .upsert({ user_id: userId, level_id: levelId }, { onConflict: 'user_id' });
    } catch {
      // A level that fails to sync is not worth interrupting anyone over; the
      // cache holds it and the next load() pushes it again.
    }
  }
}
