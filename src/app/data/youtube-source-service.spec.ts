import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { SafeStorage } from '../platform/storage';
import { TextSanitizer } from '../platform/text-sanitizer';
import { YOUTUBE_TRANSCRIPT_FN, YoutubeSourceService } from './youtube-source-service';
import { YoutubeTopicStore } from '../state/youtube-topic-store';

function invokeMock() { return vi.fn(); }

function setup(invoke = invokeMock()) {
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
        useValue: { toPlainText: (v: unknown) => JSON.stringify(v ?? '') } as TextSanitizer,
      },
      { provide: YOUTUBE_TRANSCRIPT_FN, useValue: invoke },
    ],
  });
  return {
    service: TestBed.inject(YoutubeSourceService),
    store: TestBed.inject(YoutubeTopicStore),
    invoke,
  };
}

describe('videoIdFromUrl', () => {
  it('extracts the id from a standard watch URL', async () => {
    const { service } = setup(vi.fn().mockResolvedValue([{ start: 0, text: 'Hello.' }]));
    const result = await service.load('https://www.youtube.com/watch?v=abcdefg');
    expect(result.videoId).toBe('abcdefg');
  });

  it('accepts URLs with extra query params', async () => {
    const { service } = setup(vi.fn().mockResolvedValue([{ start: 0, text: 'Hi.' }]));
    const result = await service.load('https://www.youtube.com/watch?v=abc123&t=30');
    expect(result.videoId).toBe('abc123');
  });

  it('strips www prefix', async () => {
    const { service } = setup(vi.fn().mockResolvedValue([{ start: 0, text: 'Yo.' }]));
    const result = await service.load('https://youtube.com/watch?v=abcdefg');
    expect(result.videoId).toBe('abcdefg');
  });
});

describe('YoutubeSourceService', () => {
  it('rejects non-watch URLs', async () => {
    const { service } = setup();
    await expect(service.load('https://example.com')).rejects.toThrow(/watch link/i);
  });

  it('rejects URLs with short video ids', async () => {
    const { service } = setup();
    await expect(service.load('https://www.youtube.com/watch?v=abc')).rejects.toThrow(/watch link/i);
  });

  it('merges segments into lines and stores them', async () => {
    const segments = [
      { start: 0, text: 'Hello' },
      { start: 1, text: 'world.' },
    ];
    const { service, store } = setup(vi.fn().mockResolvedValue(segments));
    const result = await service.load('https://www.youtube.com/watch?v=abcdefg');
    expect(result.videoId).toBe('abcdefg');
    expect(store.videoId()).toBe('abcdefg');
    expect(store.hasLines()).toBe(true);
    expect(result.lines.length).toBeGreaterThan(0);
  });

  it('throws when there are no segments', async () => {
    const { service } = setup(vi.fn().mockResolvedValue([]));
    await expect(
      service.load('https://www.youtube.com/watch?v=abcdefg'),
    ).rejects.toThrow(/no subtitles/i);
  });

  it('throws when the edge function fails', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('Could not load the video subtitles.'));
    const { service } = setup(fn);
    await expect(
      service.load('https://www.youtube.com/watch?v=abcdefg'),
    ).rejects.toThrow();
  });
});
