import { inject, Injectable, InjectionToken } from '@angular/core';

export const STORAGE = new InjectionToken<Storage | null>('STORAGE', {
  providedIn: 'root',
  factory: () => {
    try {
      return typeof localStorage === 'undefined' ? null : localStorage;
    } catch {
      return null;
    }
  },
});

@Injectable({ providedIn: 'root' })
export class SafeStorage {
  private readonly store = inject(STORAGE);

  read<T>(key: string): T | null {
    try {
      const raw = this.store?.getItem(key);
      return raw === null || raw === undefined ? null : (JSON.parse(raw) as T);
    } catch {
      return null;
    }
  }

  write(key: string, value: unknown): boolean {
    if (!this.store) { return false; }
    try {
      this.store.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }

  remove(key: string): boolean {
    if (!this.store) { return false; }
    try {
      this.store.removeItem(key);
      return true;
    } catch {
      return false;
    }
  }
}
