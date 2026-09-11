import { inject, Injectable, InjectionToken } from '@angular/core';
import { mergeSegmentsToLines } from '../core/transcript';
import { SUPABASE } from '../platform/supabase-client';
import { YoutubeTopicStore } from '../state/youtube-topic-store';

export const YOUTUBE_TRANSCRIPT_FN = new InjectionToken<(videoId: string) => Promise<Array<{ start: number; text: string }>>>('YOUTUBE_TRANSCRIPT_FN', {
  providedIn: 'root',
  factory: () => {
    const supabase = inject(SUPABASE);
    return async (videoId) => {
      const { data, error } = await supabase.functions.invoke<{ segments: Array<{ start: number; text: string }> }>(
        'youtube-transcript', { body: { videoId } },
      );
      if (error) { throw new Error('Could not load the video subtitles.'); }
      return data?.segments ?? [];
    };
  },
});

export function videoIdFromUrl(url: string): string | null {
  const match = /^https:\/\/(?:www\.)?youtube\.com\/watch\?v=([\w-]{6,})/.exec(url.trim());
  return match?.[1] ?? null;
}

@Injectable({ providedIn: 'root' })
export class YoutubeSourceService {
  private readonly store = inject(YoutubeTopicStore);
  private readonly fetchSegments = inject(YOUTUBE_TRANSCRIPT_FN);

  async load(url: string): Promise<{ videoId: string; lines: readonly string[] }> {
    const videoId = videoIdFromUrl(url);
    if (!videoId) { throw new Error('Paste a full YouTube watch link, like https://www.youtube.com/watch?v=abc123'); }
    const segments = await this.fetchSegments(videoId);
    if (!segments.length) { throw new Error('That video has no subtitles to practise with.'); }
    const lines = mergeSegmentsToLines(segments).map((l) => l.text);
    this.store.set(videoId, lines);
    return { videoId, lines };
  }
}
