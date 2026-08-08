import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { BannerStore } from '../state/banner-store';
import { MESSAGES } from '../state/messages';
import { BannerView } from './banner-view';

@Component({
  imports: [BannerView],
  template: `<div appBanner></div>`,
})
class Host {}

function render() {
  TestBed.resetTestingModule();
  const fixture = TestBed.createComponent(Host);
  fixture.detectChanges();
  const root = fixture.nativeElement as HTMLElement;
  return {
    fixture,
    banner: root.querySelector('.banner')!,
    store: TestBed.inject(BannerStore),
    close: () => root.querySelector<HTMLButtonElement>('.banner-close')!,
  };
}

describe('BannerView', () => {
  it('renders as <div class="banner" id="banner">', () => {
    const { banner } = render();
    expect(banner.classList.contains('banner')).toBe(true);
    expect(banner.id).toBe('banner');
  });

  it('shows the message it is given', () => {
    const { fixture, banner, store } = render();
    store.show(MESSAGES.deadVoice, 'dead-voice');
    fixture.detectChanges();

    expect(banner.classList.contains('show')).toBe(true);
    expect(banner.querySelector('.banner-text')?.textContent)
      .toContain('not producing any audio');
  });

  it('renders the markup inside a message', () => {
    const { fixture, banner, store } = render();
    store.show('pick another <b>voice</b>', 'dead-voice');
    fixture.detectChanges();
    expect(banner.querySelector('.banner-text b')?.textContent).toBe('voice');
  });
});

describe('BannerView dismissal', () => {
  it('offers a labelled close button', () => {
    const { close } = render();
    expect(close().getAttribute('aria-label')).toBe('Dismiss');
    expect(close().title).toBe('Dismiss');
  });

  it('hides the banner when closed', () => {
    const { fixture, banner, store, close } = render();
    store.show(MESSAGES.deadVoice, 'dead-voice');
    fixture.detectChanges();
    expect(banner.classList.contains('show')).toBe(true);

    close().click();
    fixture.detectChanges();

    expect(banner.classList.contains('show')).toBe(false);
    expect(store.visible()).toBe(false);
  });

  it('closes whichever source raised it', () => {
    for (const source of ['no-voice', 'unsupported', 'dead-voice', 'stt-denied', 'summary'] as const) {
      const { fixture, store, close } = render();
      store.show('something happened', source);
      fixture.detectChanges();

      close().click();
      fixture.detectChanges();
      expect(store.visible()).toBe(false);
    }
  });

  it('lets a later message reappear after a dismissal', () => {
    const { fixture, banner, store, close } = render();
    store.show(MESSAGES.deadVoice, 'dead-voice');
    fixture.detectChanges();
    close().click();
    fixture.detectChanges();

    store.show(MESSAGES.noEnglishVoice, 'no-voice');
    fixture.detectChanges();
    expect(banner.classList.contains('show')).toBe(true);
  });
});
