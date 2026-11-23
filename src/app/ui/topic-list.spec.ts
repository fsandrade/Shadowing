import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { RANDOM } from '../platform/rng';
import { SafeStorage } from '../platform/storage';
import { CATALOG } from '../state/catalog-token';
import { NO_SHUFFLE, signedOutBackend, storedSettings, TEST_CATALOG } from '../testing/catalog';
import { TopicList } from './topic-list';

const DATA = TEST_CATALOG;

beforeEach(() => {
  for (const key of Object.keys(localStorage).filter((k) => k.startsWith('shadowing.'))) {
    localStorage.removeItem(key);
  }
});

function master(...ids: string[]): void {
  localStorage.setItem('shadowing.attempts', JSON.stringify(
    ids.map((sentenceId) => ({
      sentenceId,
      status: 'scored',
      stars: 5,
      attemptedAt: new Date().toISOString(),
    })),
  ));
}

@Component({
  imports: [TopicList],
  template: `<nav appTopicList [selected]="selected()" (pick)="picked.push($event)"></nav>`,
})
class Host {
  
  
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
        useValue: storedSettings() as unknown as SafeStorage,
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
  it('offers All topics first, then every topic that has sentences', () => {
    const { buttons } = render();
    expect(buttons()[0].querySelector('.deck-name')?.textContent?.trim()).toBe('All topics');
    expect(buttons().slice(1).map((b) => b.dataset['deckId'])).toEqual(['a', 'b', 'c']);
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

  it('shows how many sentences are left, per topic and overall', () => {
    const { root } = render();
    const label = (selector: string) =>
      root.querySelector(`${selector} .deck-count`)?.textContent?.trim();

    expect(label('#allTopics')).toBe('6 left');
    expect(label('[data-deck-id="a"]')).toBe('3 left');
    expect(label('[data-deck-id="b"]')).toBe('1 left');
    expect(label('[data-deck-id="c"]')).toBe('2 left');
  });

  it('shows Mastered when every sentence in a topic has five stars', () => {
    master('s-a1', 's-a2', 's-a3');
    const { root } = render();

    expect(root.querySelector('[data-deck-id="a"] .deck-count')?.textContent?.trim())
      .toBe('Mastered');
    expect(root.querySelector('#allTopics .deck-count')?.textContent?.trim()).toBe('3 left');
  });

  it('marks All topics mastered once everything is done', () => {
    master('s-a1', 's-a2', 's-a3', 's-b1', 's-c1', 's-c2');
    const { root } = render();

    expect(root.querySelector('#allTopics .deck-count')?.textContent?.trim()).toBe('Mastered');
  });
});
