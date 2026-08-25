import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { BannerStore } from './banner-store';

describe('BannerStore', () => {
  let banner: BannerStore;

  beforeEach(() => {
    TestBed.resetTestingModule();
    banner = TestBed.inject(BannerStore);
  });

  it('starts hidden', () => {
    expect(banner.visible()).toBe(false);
    expect(banner.html()).toBeNull();
  });

  it('shows the given html', () => {
    banner.show('<b>oops</b>', 'no-voice');
    expect(banner.visible()).toBe(true);
    expect(banner.html()).toBe('<b>oops</b>');
  });

  it('a later source takes the banner over', () => {
    banner.show('first', 'no-voice');
    banner.show('second', 'dead-voice');
    expect(banner.html()).toBe('second');
  });

  it('clear dismisses when the source owns the banner', () => {
    banner.show('mine', 'no-voice');
    banner.clear('no-voice');
    expect(banner.visible()).toBe(false);
  });

  it('clear is a no-op when another source owns the banner', () => {
    banner.show('theirs', 'dead-voice');
    banner.clear('no-voice');
    expect(banner.visible()).toBe(true);
    expect(banner.html()).toBe('theirs');
  });

  it('clearAll dismisses regardless of owner', () => {
    banner.show('theirs', 'dead-voice');
    banner.clearAll();
    expect(banner.visible()).toBe(false);
  });

  it('clearTransient drops a complaint a retry can disprove', () => {
    banner.show('the voice made no sound', 'dead-voice');
    banner.clearTransient();
    expect(banner.visible()).toBe(false);
  });

  it('clearTransient keeps a standing fact about the browser or the session', () => {
    for (const source of ['stt-denied', 'no-voice', 'unsupported'] as const) {
      banner.show(source, source);
      banner.clearTransient();
      expect(banner.html(), `${source} should survive a retry`).toBe(source);
    }
  });

  it('clearTransient on an empty banner is harmless', () => {
    expect(() => banner.clearTransient()).not.toThrow();
    expect(banner.visible()).toBe(false);
  });

  it('clear on an empty banner is harmless', () => {
    expect(() => banner.clear('dead-voice')).not.toThrow();
    expect(banner.visible()).toBe(false);
  });
});
