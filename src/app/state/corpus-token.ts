import { InjectionToken } from '@angular/core';
import { type Corpus } from '../core/deck';
import { CORPUS } from '../data/corpus';

/** The corpus, injectable so stores can be tested against a small fixture. */
export const CORPUS_DATA = new InjectionToken<Corpus>('CORPUS_DATA', {
  providedIn: 'root',
  factory: () => CORPUS,
});
