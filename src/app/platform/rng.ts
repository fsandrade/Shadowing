import { InjectionToken } from '@angular/core';
import type { Rng } from '../core/shuffle';

export const RANDOM = new InjectionToken<Rng>('RANDOM', {
  providedIn: 'root',
  factory: (): Rng => Math.random,
});
