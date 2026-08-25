import { inject, Injectable } from '@angular/core';
import { SafeStorage } from '../platform/storage';

export const QUEUE_KEY = 'shadowing.pendingProgress';

export type PendingKind = 'session' | 'attempt' | 'session-end';

export interface Pending {
  readonly kind: PendingKind;

  readonly userId: string;
  readonly row: Record<string, unknown>;
}

const LIMIT = 500;

@Injectable({ providedIn: 'root' })
export class AttemptQueue {
  private readonly storage = inject(SafeStorage);

  read(): Pending[] {
    const raw = this.storage.read<unknown>(QUEUE_KEY);
    if (!Array.isArray(raw)) { return []; }
    return raw.filter((entry): entry is Pending =>
      !!entry
      && typeof entry === 'object'
      && typeof (entry as Pending).kind === 'string'
      && typeof (entry as Pending).userId === 'string'
      && !!(entry as Pending).row);
  }

  write(entries: readonly Pending[]): void {
    this.storage.write(QUEUE_KEY, entries.slice(-LIMIT));
  }

  add(entry: Pending): void {
    this.write([...this.read(), entry]);
  }

  clear(): void {
    this.storage.write(QUEUE_KEY, []);
  }
}
