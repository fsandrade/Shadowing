import { inject, Injectable, InjectionToken } from '@angular/core';

/**
 * `localStorage` is absent in some embeddings and throws on access in others
 * (Safari private mode), so it is resolved lazily and may be null.
 */
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

/** JSON-in, JSON-out storage that never throws. */
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

  write(key: string, value: unknown): void {
    try {
      this.store?.setItem(key, JSON.stringify(value));
    } catch {
      /* private mode, quota, or no storage: settings are a nice-to-have */
    }
  }
}
