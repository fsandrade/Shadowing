import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { YoutubeSourceService } from '../data/youtube-source-service';
import { SafeStorage } from '../platform/storage';
import { TextSanitizer } from '../platform/text-sanitizer';
import { YoutubeTopicStore } from '../state/youtube-topic-store';
import { YoutubeLink } from './youtube-link';

@Component({
  imports: [YoutubeLink],
  template: `<div appYoutubeLink></div>`,
})
class Host {}

function render(load?: ReturnType<typeof vi.fn>) {
  const backing = new Map<string, unknown>();
  let store: YoutubeTopicStore;
  const defaultLoad = vi.fn((url: string) => {
    store.set('abc', ['One.', 'Two.'], [0, 1]);
    return Promise.resolve({ videoId: 'abc', lines: ['One.', 'Two.'], starts: [0, 1] });
  });

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      {
        provide: SafeStorage,
        useValue: {
          read: (key: string) => backing.get(key) ?? null,
          write: (key: string, value: unknown) => { backing.set(key, value); },
        },
      },
      { provide: TextSanitizer, useValue: { toPlainText: (v: unknown) => String(v ?? '') } },
    ],
  });
  TestBed.overrideProvider(YoutubeSourceService, { useValue: { load: load ?? defaultLoad } as unknown as YoutubeSourceService });

  store = TestBed.inject(YoutubeTopicStore);
  const fixture = TestBed.createComponent(Host);
  fixture.detectChanges();
  const root = (fixture.nativeElement as HTMLElement).querySelector('.youtube-link')!;
  const q = <T extends HTMLElement>(sel: string) => root.querySelector<T>(sel)!;

  return {
    fixture,
    root,
    q,
    load: load ?? defaultLoad,
    store,
  };
}

describe('YoutubeLink', () => {
  it('keeps Load disabled until a link has been typed', () => {
    const { fixture, q } = render();

    expect(q<HTMLButtonElement>('#youtubeLoad').disabled).toBe(true);

    q<HTMLInputElement>('#youtubeLink').value = 'https://www.youtube.com/watch?v=abc';
    q<HTMLInputElement>('#youtubeLink').dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(q<HTMLButtonElement>('#youtubeLoad').disabled).toBe(false);
  });

  it('counts the sentences once a video loads', async () => {
    const { fixture, q, load, store } = render();

    q<HTMLInputElement>('#youtubeLink').value = 'https://www.youtube.com/watch?v=abc';
    q<HTMLInputElement>('#youtubeLink').dispatchEvent(new Event('input'));
    fixture.detectChanges();
    q<HTMLButtonElement>('#youtubeLoad').click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(load).toHaveBeenCalledWith('https://www.youtube.com/watch?v=abc');
    expect(store.hasLines()).toBe(true);
    expect(q('.youtube-ready').textContent).toMatch(/2 sentences ready/);
  });

  it('turns a load failure into an inline error', async () => {
    const { fixture, q, store } = render(vi.fn(() => Promise.reject(new Error('That video has no subtitles to practise with.'))));

    q<HTMLInputElement>('#youtubeLink').value = 'https://www.youtube.com/watch?v=abc';
    q<HTMLInputElement>('#youtubeLink').dispatchEvent(new Event('input'));
    fixture.detectChanges();
    q<HTMLButtonElement>('#youtubeLoad').click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(q('.youtube-error').textContent)
      .toBe('That video has no subtitles to practise with.');
    expect(store.hasLines()).toBe(false);
  });
});