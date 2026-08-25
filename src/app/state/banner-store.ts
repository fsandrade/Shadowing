import { computed, Injectable, signal } from '@angular/core';

export type BannerSource =
  | 'no-voice'
  | 'unsupported'
  | 'dead-voice'
  | 'stt-denied';

// The banners a fresh Play can disprove. Everything else is a standing fact
// about the browser or the session - a denied microphone does not un-deny
// itself because the learner pressed Play, and hiding it there is how the
// warning went unseen in the first place.
const TRANSIENT: ReadonlySet<BannerSource> = new Set<BannerSource>(['dead-voice']);

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

  clearTransient(): void {
    const source = this.source();
    if (source !== null && TRANSIENT.has(source)) { this.clearAll(); }
  }

  clearAll(): void {
    this.source.set(null);
    this.html.set(null);
  }
}
