import { computed, inject, Injectable, signal } from '@angular/core';
import { SafeStorage } from '../platform/storage';
import { TextSanitizer } from '../platform/text-sanitizer';

const KEY = 'shadowing.youtubeTopic';

interface Stored {
  readonly videoId: string;
  readonly lines: readonly string[];
}

function clean(raw: unknown, sanitizer: TextSanitizer): Stored {
  const json = sanitizer.toPlainText(
    typeof raw === 'string' ? raw : JSON.stringify(raw),
  );
  try {
    const parsed = JSON.parse(json) as Partial<Stored> | null;
    if (parsed && typeof parsed.videoId === 'string' && parsed.videoId) {
      const lines = Array.isArray(parsed.lines)
        ? parsed.lines.filter((l): l is string => typeof l === 'string')
        : [];
      return { videoId: parsed.videoId, lines };
    }
  } catch { /* fall through */ }
  return { videoId: '', lines: [] };
}

@Injectable({ providedIn: 'root' })
export class YoutubeTopicStore {
  private readonly storage = inject(SafeStorage);
  private readonly sanitizer = inject(TextSanitizer);

  private readonly saved = clean(this.storage.read<unknown>(KEY), this.sanitizer);

  readonly videoId = signal<string | null>(this.saved.videoId || null);
  readonly lines = signal<readonly string[]>(this.saved.lines);

  readonly hasLines = computed(() => this.lines().length > 0);

  set(videoId: string, lines: readonly string[]): void {
    this.videoId.set(videoId);
    this.lines.set(lines);
    this.storage.write(KEY, { videoId, lines });
  }

  clear(): void {
    this.videoId.set(null);
    this.lines.set([]);
    this.storage.write(KEY, { videoId: '', lines: [] });
  }
}
