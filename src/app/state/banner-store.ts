import { computed, Injectable, signal } from '@angular/core';

export type BannerSource =
  | 'no-voice'
  | 'unsupported'
  | 'dead-voice'
  | 'stt-denied'
  | 'summary';

@Injectable({ providedIn: 'root' })
export class BannerStore {
  private readonly source = signal<BannerSource | null>(null);

  readonly html = signal<string | null>(null);
  readonly visible = computed(() => this.html() !== null);

  show(html: string, source: BannerSource): void {
    this.source.set(source);
    this.html.set(html);
  }

  clear(source: BannerSource): void {
    if (this.source() !== source) { return; }
    this.clearAll();
  }

  clearAll(): void {
    this.source.set(null);
    this.html.set(null);
  }
}
