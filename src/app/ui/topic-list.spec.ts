import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { RANDOM } from '../platform/rng';
import { SafeStorage } from '../platform/storage';
import { CATALOG } from '../state/catalog-token';
import { NO_SHUFFLE, signedOutBackend, storedProfile, TEST_CATALOG } from '../testing/catalog';
import { TopicList } from './topic-list';

const DATA = TEST_CATALOG;

@Component({
  imports: [TopicList],
  template: `<nav appTopicList [selected]="selected()" (pick)="picked.push($event)"></nav>`,
})
class Host {
  // A signal, not a plain field: change detection is zoneless, so only a
  // signal read from the template marks this host dirty for the next tick.
  readonly selected = signal<string | null>(null);
  readonly picked: Array<string | null> = [];
}

function render() {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      ...signedOutBackend(),
      {
        provide: SafeStorage,
        useValue: storedProfile() as unknown as SafeStorage,
      },
      { provide: CATALOG, useValue: DATA },
      { provide: RANDOM, useValue: NO_SHUFFLE },
    ],
  });
  const fixture = TestBed.createComponent(Host);
  fixture.detectChanges();
  const root = (fixture.nativeElement as HTMLElement).querySelector('#decks')!;
  return {
    fixture,
    root,
    host: fixture.componentInstance,
    buttons: () => [...root.querySelectorAll<HTMLButtonElement>('button')],
  };
}

describe('TopicList', () => {
  it('offers All topics first, then every topic at the level', () => {
    const { buttons } = render();
    expect(buttons()[0].textContent?.trim()).toBe('All topics');
    expect(buttons().slice(1).map((b) => b.dataset['deckId'])).toEqual(['a', 'b']);
  });

  it('marks All topics when nothing is selected', () => {
    const { buttons } = render();
    expect(buttons()[0].getAttribute('aria-pressed')).toBe('true');
  });

  it('marks the selected topic instead', () => {
    const { fixture, host, buttons } = render();
    host.selected.set('b');
    fixture.detectChanges();
    expect(buttons()[0].getAttribute('aria-pressed')).toBe('false');
    expect(buttons().find((b) => b.dataset['deckId'] === 'b')!.getAttribute('aria-pressed'))
      .toBe('true');
  });

  it('reports a pick without changing anything itself', () => {
    const { fixture, host, buttons } = render();
    buttons()[1].click();
    fixture.detectChanges();
    expect(host.picked).toEqual(['a']);
    expect(host.selected()).toBeNull();
  });

  it('reports null when All topics is picked', () => {
    const { fixture, host, buttons } = render();
    host.selected.set('a');
    fixture.detectChanges();
    buttons()[0].click();
    expect(host.picked).toEqual([null]);
  });

  it('no longer offers My text — that is an activity now', () => {
    const { root } = render();
    expect(root.querySelector('#myText')).toBeNull();
  });
});
