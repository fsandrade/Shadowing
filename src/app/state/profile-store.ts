import { computed, inject, Injectable, signal } from '@angular/core';
import { SafeStorage } from '../platform/storage';
import { SETTINGS_KEY } from './settings-store';

export const PROFILE_KEY = 'shadowing.profile';

interface StoredProfile {
  levelId?: unknown;
}

function levelOf(value: unknown): string | null {
  return typeof value === 'string' && value ? value : null;
}



@Injectable({ providedIn: 'root' })
export class ProfileStore {
  private readonly storage = inject(SafeStorage);

  readonly levelId = signal<string | null>(this.adopt());

  readonly chosen = computed(() => this.levelId() !== null);

  setLevel(id: string): void {
    this.levelId.set(id);
    this.cache(id);
  }

  clear(): void {
    this.levelId.set(null);
    this.cache(null);
  }

  load(): Promise<void> {
    
    
    return Promise.resolve();
  }

  private adopt(): string | null {
    const own = levelOf(this.storage.read<StoredProfile>(PROFILE_KEY)?.levelId);
    if (own) { return own; }

    
    
    
    const legacy = levelOf(this.storage.read<StoredProfile>(SETTINGS_KEY)?.levelId);
    if (legacy) { this.cache(legacy); }
    return legacy;
  }

  private cache(levelId: string | null): void {
    this.storage.write(PROFILE_KEY, { levelId });
  }
}
