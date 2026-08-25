import { InjectionToken } from '@angular/core';
import { type Catalog } from '../core/catalog';

export const CATALOG = new InjectionToken<Catalog>('CATALOG');
