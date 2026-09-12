import { computed, inject, Injectable, signal } from '@angular/core';
import { SafeStorage } from '../platform/storage';
import { TextSanitizer } from '../platform/text-sanitizer';

const KEY = 'shadowing.youtubeTopic';

interface Stored {
  readonly videoId: string;
  readonly lines: readonly string[];
  readonly starts: readonly number[];
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
      const starts = Array.isArray(parsed.starts)
        ? parsed.starts.filter((s): s is number => typeof s === 'number')
        : [];
      return { videoId: parsed.videoId, lines, starts };
    }
  } catch { /* fall through */ }
  return { videoId: '', lines: [], starts: [] };
}

@Injectable({ providedIn: 'root' })
export class YoutubeTopicStore {
  private readonly storage = inject(SafeStorage);
  private readonly sanitizer = inject(TextSanitizer);

  private readonly saved = clean(this.storage.read<unknown>(KEY), this.sanitizer);

  readonly videoId = signal<string | null>(this.saved.videoId || null);
  readonly lines = signal<readonly string[]>(this.saved.lines);
  readonly starts = signal<readonly number[]>(this.saved.starts);

  readonly hasLines = computed(() => this.lines().length > 0);

  set(videoId: string, lines: readonly string[], starts: readonly number[] = []): void {
    this.videoId.set(videoId);
    this.lines.set(lines);
    this.starts.set(starts);
    this.storage.write(KEY, { videoId, lines, starts });
  }

  clear(): void {
    this.videoId.set(null);
    this.lines.set([]);
    this.starts.set([]);
    this.storage.write(KEY, { videoId: '', lines: [], starts: [] });
  }
}
