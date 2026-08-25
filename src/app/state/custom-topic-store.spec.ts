import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { CUSTOM_TEXT_LIMIT } from '../core/sentences';
import { SafeStorage } from '../platform/storage';
import { CustomTopicStore } from './custom-topic-store';

const KEY = 'shadowing.customTopic';

function setup(stored: unknown = null) {
  const write = vi.fn();
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      {
        provide: SafeStorage,
        useValue: {
          read: (key: string) => (key === KEY ? stored : null),
          write,
        } as unknown as SafeStorage,
      },
    ],
  });
  return { store: TestBed.inject(CustomTopicStore), write };
}

describe('CustomTopicStore', () => {
  it('starts empty when nothing is stored', () => {
    const { store } = setup();
    expect(store.text()).toBe('');
    expect(store.lines()).toEqual([]);
    expect(store.hasText()).toBe(false);
  });

  it('splits saved text into sentences', () => {
    const { store } = setup();
    store.setText('First one. Second one!');
    expect(store.lines()).toEqual(['First one.', 'Second one!']);
    expect(store.hasText()).toBe(true);
  });

  it('persists the sanitised text, not the raw input', () => {
    const { store, write } = setup();
    store.setText('<b>Keep</b> this. <script>alert(1)</script>And this.');
    expect(write).toHaveBeenCalledWith(KEY, 'Keep this. And this.');
    expect(store.text()).toBe('Keep this. And this.');
  });

  it('clears both the signal and storage', () => {
    const { store, write } = setup('Something here.');
    expect(store.hasText()).toBe(true);

    store.clear();
    expect(store.text()).toBe('');
    expect(store.lines()).toEqual([]);
    expect(write).toHaveBeenCalledWith(KEY, '');
  });

  it('caps the text at the limit', () => {
    const { store } = setup();
    store.setText('a'.repeat(CUSTOM_TEXT_LIMIT + 500));
    expect(store.text().length).toBe(CUSTOM_TEXT_LIMIT);
  });
});

describe('CustomTopicStore does not trust its own storage', () => {
  it('sanitises markup that was written straight into localStorage', () => {
    const { store } = setup('<img src=x onerror=alert(1)>Tampered.');
    expect(store.text()).toBe('Tampered.');
    expect(store.lines()).toEqual(['Tampered.']);
  });

  it('ignores a stored value that is not a string', () => {
    expect(setup({ evil: true }).store.text()).toBe('');
    expect(setup(['a', 'b']).store.text()).toBe('');
    expect(setup(12345).store.text()).toBe('');
  });

  it('caps an oversized stored value', () => {
    const { store } = setup('b'.repeat(CUSTOM_TEXT_LIMIT * 3));
    expect(store.text().length).toBe(CUSTOM_TEXT_LIMIT);
  });
});
