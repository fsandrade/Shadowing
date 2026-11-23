import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { RANDOM } from '../platform/rng';
import { Speaker } from '../platform/speaker';
import { SafeStorage } from '../platform/storage';
import { CATALOG } from '../state/catalog-token';
import { PracticeStore } from '../state/practice-store';
import { NO_SHUFFLE, signedOutBackend, storedSettings, TEST_CATALOG } from '../testing/catalog';
import { Dictation } from './dictation';

@Component({
  imports: [Dictation],
  template: `<main appDictation class="full"></main>`,
})
class Host {}

function render() {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      ...signedOutBackend(),
      {
        provide: SafeStorage,
        useValue: storedSettings() as unknown as SafeStorage,
      },
      { provide: CATALOG, useValue: TEST_CATALOG },
      { provide: RANDOM, useValue: NO_SHUFFLE },
      {
        provide: Speaker,
        useValue: {
          supported: true,
          voices: () => [],
          onVoicesChanged: () => {},
          speak: () => Promise.resolve(),
          cancel: () => {},
          keepAlive: () => {},
        } as unknown as Speaker,
      },
    ],
  });
  const practice = TestBed.inject(PracticeStore);
  practice.selectTopic('a');
  const fixture = TestBed.createComponent(Host);
  fixture.detectChanges();
  const root = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('main.dictation')!;
  return { fixture, root };
}

function type(fixture: { detectChanges(): void }, root: HTMLElement, text: string) {
  const input = root.querySelector<HTMLInputElement>('#dictInput')!;
  input.value = text;
  input.dispatchEvent(new Event('input'));
  fixture.detectChanges();
}

function clicked(root: HTMLElement, id: string): void {
  (root.querySelector(`#${id}`) as HTMLElement).click();
}

describe('Dictation screen', () => {
  it('shows 1 / N, a replay button, and the type box; no answer text yet', () => {
    const { root } = render();
    expect(root.querySelector('#dictationCount')?.textContent?.trim()).toBe('1 / 3');
    expect(root.querySelector('#dictReplay')).not.toBeNull();
    expect(root.querySelector('#dictInput')).not.toBeNull();
    expect(root.querySelector('#dictCheck')).not.toBeNull();
    expect(root.querySelector('#dictSkip')).not.toBeNull();
    expect(root.querySelector('.dict-answer')).toBeNull();
  });

  it('decorates as correct and hides the box after an exact match', () => {
    const { fixture, root } = render();
    type(fixture, root, 'a1');
    clicked(root, 'dictCheck');
    fixture.detectChanges();

    expect(root.querySelector('.dict-verdict')?.classList.contains('correct')).toBe(true);
    expect(root.querySelector('#dictInput')).toBeNull();
    expect(root.querySelector('.dict-answer')?.textContent?.trim()).toBe('a1');
  });

  it('decorates as incorrect and masks the wrong words after a mismatch', () => {
    const { fixture, root } = render();
    type(fixture, root, 'nope');
    clicked(root, 'dictCheck');
    fixture.detectChanges();

    expect(root.querySelector('.dict-verdict')?.classList.contains('incorrect')).toBe(true);
    const masked = root.querySelector('.dict-answer .dict-masked');
    expect(masked).not.toBeNull();
    expect(masked?.textContent).toBe('**');
  });

  it('Skip reveals the answer and advances to the next challenge', () => {
    const { fixture, root } = render();
    clicked(root, 'dictSkip');
    fixture.detectChanges();

    
    expect(root.querySelector('#dictationCount')?.textContent?.trim()).toBe('2 / 3');
    expect(root.querySelector('#dictInput')).not.toBeNull();

    
    clicked(root, 'dictPrev');
    fixture.detectChanges();
    expect(root.querySelector('.dict-verdict')?.classList.contains('incorrect')).toBe(true);
    expect(root.querySelector('.dict-answer')).not.toBeNull();
  });

  it('the Move-to select jumps to a challenge', () => {
    const { fixture, root } = render();
    const select = root.querySelector<HTMLSelectElement>('#dictMoveTo')!;
    select.value = '2';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(root.querySelector('#dictationCount')?.textContent?.trim()).toBe('3 / 3');
  });
});