import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { SafeStorage } from '../platform/storage';
import { TextSanitizer } from '../platform/text-sanitizer';
import { YoutubeTopicStore } from './youtube-topic-store';

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
        useValue: { toPlainText: (v: unknown) => JSON.stringify(v ?? '') } as TextSanitizer,
      },
    ],
  });
  return { store: TestBed.inject(YoutubeTopicStore), backing };
}

describe('YoutubeTopicStore', () => {
  it('starts empty', () => {
    const { store } = setup();
    expect(store.videoId()).toBeNull();
    expect(store.lines()).toEqual([]);
    expect(store.hasLines()).toBe(false);
  });

  it('stores a video and its lines', () => {
    const { store } = setup();
    store.set('wtMUy_3NGl4', ['Once upon a time', 'In a kingdom far away']);
    expect(store.videoId()).toBe('wtMUy_3NGl4');
    expect(store.lines()).toEqual(['Once upon a time', 'In a kingdom far away']);
    expect(store.hasLines()).toBe(true);
  });

  it('restores from storage on construction', () => {
    const { backing } = setup();
    backing.set('shadowing.youtubeTopic', { videoId: 'abc', lines: ['hello world'] });
    const fresh = TestBed.inject(YoutubeTopicStore);
    expect(fresh.videoId()).toBe('abc');
    expect(fresh.lines()).toEqual(['hello world']);
  });

  it('clear() empties the store', () => {
    const { store } = setup();
    store.set('abc', ['x']);
    store.clear();
    expect(store.hasLines()).toBe(false);
    expect(store.videoId()).toBeNull();
  });
});
