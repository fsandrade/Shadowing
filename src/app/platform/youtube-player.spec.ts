import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SafeStorage } from '../platform/storage';
import { TextSanitizer } from '../platform/text-sanitizer';
import { YoutubeTopicStore } from '../state/youtube-topic-store';
import { YoutubePlayerService } from './youtube-player';

// A stand-in for window.YT.Player that records what the service does to it, so
// the assertions check real calls rather than a mocked service.
class FakePlayer {
  static readonly instances: FakePlayer[] = [];
  readonly cueVideoById = vi.fn();
  readonly seekTo = vi.fn();
  readonly playVideo = vi.fn();
  readonly pauseVideo = vi.fn();

  constructor(
    el: HTMLElement,
    opts: { videoId: string; events: { onReady?: () => void } },
  ) {
    FakePlayer.instances.push(this);
    opts.events.onReady?.();
  }
}

function installFakeYT(): void {
  window.YT = { Player: FakePlayer } as unknown as Window['YT'];
}

function fakeContainer(): HTMLDivElement {
  const el = document.createElement('div');
  el.id = 'youtube-host';
  return el;
}

function setup() {
  const backing = new Map<string, unknown>();
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      {
        provide: SafeStorage,
        useValue: {
          read: (k: string) => backing.get(k) ?? null,
          write: (k: string, v: unknown) => { backing.set(k, v); },
        } as unknown as SafeStorage,
      },
      {
        provide: TextSanitizer,
        useValue: { toPlainText: (v: unknown) => (typeof v === 'string' ? v : '') } as TextSanitizer,
      },
    ],
  });
  return {
    service: TestBed.inject(YoutubePlayerService),
    store: TestBed.inject(YoutubeTopicStore),
  };
}

describe('YoutubePlayerService', () => {
  afterEach(() => {
    FakePlayer.instances.length = 0;
    delete window.YT;
    delete window.onYouTubeIframeAPIReady;
  });

  it('returns false for a segment when the player never becomes ready', async () => {
    const { service } = setup();
    service.attach(fakeContainer(), 'abc');
    const ok = await service.playSegment(0);
    expect(ok).toBe(false);
  });

  it('seeks to the stored start and plays once the iframe API is present', async () => {
    installFakeYT();
    const { service, store } = setup();
    store.set('abc', ['First', 'Second'], [0, 3.5]);

    service.attach(fakeContainer(), 'abc');
    await service.ready;

    const ok = await service.playSegment(1);

    expect(ok).toBe(true);
    const player = FakePlayer.instances[0];
    expect(player.seekTo).toHaveBeenCalledWith(3.5, true);
    expect(player.playVideo).toHaveBeenCalled();
    expect(player.cueVideoById).toHaveBeenCalledWith('abc');
  });

  it('falls back to zero when the store has no start for the line', async () => {
    installFakeYT();
    const { service, store } = setup();
    store.set('abc', ['First'], []);

    service.attach(fakeContainer(), 'abc');
    await service.ready;

    await service.playSegment(0);

    expect(FakePlayer.instances[0].seekTo).toHaveBeenCalledWith(0, true);
  });

  it('pauses the player on stop', async () => {
    installFakeYT();
    const { service } = setup();
    service.attach(fakeContainer(), 'abc');
    await service.ready;

    service.stop();

    expect(FakePlayer.instances[0].pauseVideo).toHaveBeenCalled();
  });
});
