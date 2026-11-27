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
  const base = Date.parse('2026-11-20T09:00:00.000Z');
  localStorage.setItem('shadowing.attempts', JSON.stringify(
    ids.flatMap((sentenceId) => [0, 1, 2].map((i) => ({
      sentenceId,
      status: 'scored',
      stars: 5,
      attemptedAt: new Date(base + i).toISOString(),
    }))),
  ));
}

@Component({
  imports: [TopicList],
  template: `<nav appTopicList [selected]="selected()" [hasPick]="hasPick()" (pick)="picked.push($event)"></nav>`,
})
class Host {
  
  
  readonly selected = signal<string | null>(null);
  readonly hasPick = signal(false);
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

  it('does not mark All topics before any pick', () => {
    const { buttons } = render();
    expect(buttons()[0].getAttribute('aria-pressed')).toBe('false');
  });

  it('marks All topics once it is picked', () => {
    const { fixture, host, buttons } = render();
    host.hasPick.set(true);
    fixture.detectChanges();
    expect(buttons()[0].getAttribute('aria-pressed')).toBe('true');
  });

  it('marks the selected topic instead', () => {
    const { fixture, host, buttons } = render();
    host.hasPick.set(true);
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

  it('shows new, learning and due counts per topic and overall', () => {
    const { root } = render();
    const count = (selector: string, kind: string) =>
      root.querySelector(`${selector} .deck-count.${kind}`)?.textContent?.trim();

    for (const [selector, expected] of [
      ['#allTopics', ['N 6', 'L 0', 'D 0']],
      ['[data-deck-id="a"]', ['N 3', 'L 0', 'D 0']],
      ['[data-deck-id="b"]', ['N 1', 'L 0', 'D 0']],
      ['[data-deck-id="c"]', ['N 2', 'L 0', 'D 0']],
    ] as const) {
      expect([count(selector, 'new'), count(selector, 'learn'), count(selector, 'due')])
        .toEqual(expected);
    }
  });

  it('moves a sentence from new to learning after one attempt', () => {
    const base = Date.parse('2026-11-20T09:00:00.000Z');
    localStorage.setItem('shadowing.attempts', JSON.stringify([{
      sentenceId: 's-a1', status: 'scored', stars: 5,
      attemptedAt: new Date(base).toISOString(),
    }]));
    const { root } = render();
    const count = (kind: string) =>
      root.querySelector(`[data-deck-id="a"] .deck-count.${kind}`)?.textContent?.trim();

    expect([count('new'), count('learn'), count('due')]).toEqual(['N 2', 'L 1', 'D 0']);
  });

  it('counts mastered sentences as due, with an accessible label', () => {
    master('s-a1', 's-a2', 's-a3');
    const { root } = render();
    const button = root.querySelector<HTMLButtonElement>('[data-deck-id="a"]')!;

    expect([...button.querySelectorAll('.deck-count')].map((el) => el.textContent?.trim()))
      .toEqual(['N 0', 'L 0', 'D 3']);
    expect(button.querySelector('.deck-counts')?.getAttribute('aria-label'))
      .toBe('0 new, 0 learning, 3 due');
  });
});
