import { InjectionToken } from '@angular/core';
import { type Corpus } from '../core/deck';
import { CORPUS } from '../data/corpus';

export const CORPUS_DATA = new InjectionToken<Corpus>('CORPUS_DATA', {
  providedIn: 'root',
  factory: () => CORPUS,
});
