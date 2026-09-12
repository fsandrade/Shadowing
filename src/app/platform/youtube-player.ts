import { computed, inject, Injectable } from '@angular/core';
import { YoutubeTopicStore } from '../state/youtube-topic-store';

interface YTPlayer {
  cueVideoById(videoId: string): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  playVideo(): void;
  pauseVideo(): void;
}

interface YTNamespace {
  Player: new (
    el: HTMLElement,
    opts: { videoId: string; events: { onReady?: () => void } },
  ) => YTPlayer;
}

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

const API_URL = 'https://www.youtube.com/iframe_api';

// The iframe API bootstraps once per page: a second script tag would clobber
// the first window.onYouTubeIframeAPIReady callback.
let apiLoaded = false;

@Injectable({ providedIn: 'root' })
export class YoutubePlayerService {
  private readonly youtube = inject(YoutubeTopicStore);

  private container: HTMLElement | null = null;
  private player: YTPlayer | null = null;
  private pending: string | null = null;
  private resolveReady: (() => void) | null = null;

  readonly ready: Promise<void> = new Promise<void>((resolve) => {
    this.resolveReady = resolve;
  });

  readonly videoId = computed<string | null>(() => this.youtube.videoId());

  attach(container: HTMLElement, videoId: string): void {
    this.container = container;
    this.pending = videoId;
    this.player = null;
    if (window.YT?.Player) {
      this.create(videoId);
      return;
    }
    this.loadApiOnce();
  }

  stop(): void {
    this.player?.pauseVideo();
  }

  // Start times live in the store now, so a failed load just reads as 0.
  loadStartTimes(): readonly number[] {
    return this.youtube.starts();
  }

  playSegment(lineIndex: number): Promise<boolean> {
    if (!this.player) { return Promise.resolve(false); }
    const start = this.loadStartTimes()[lineIndex] ?? 0;
    this.player.seekTo(start, true);
    this.player.playVideo();
    return Promise.resolve(true);
  }

  private create(videoId: string): void {
    if (!this.container || !window.YT) { return; }
    this.player = new window.YT.Player(this.container, {
      videoId,
      events: { onReady: () => { /* ready to seek */ } },
    });
    // Re-attach with a new video has to swap the clip, not just the element.
    this.player.cueVideoById(videoId);
    this.resolveReady?.();
    this.resolveReady = null;
  }

  private loadApiOnce(): void {
    if (apiLoaded) { return; }
    apiLoaded = true;
    const tag = document.createElement('script');
    tag.src = API_URL;
    document.head.appendChild(tag);
    const existing = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      existing?.();
      if (this.pending && window.YT?.Player) { this.create(this.pending); }
    };
  }
}
