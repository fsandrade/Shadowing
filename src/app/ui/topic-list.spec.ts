import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { type Corpus } from '../core/deck';
import { SafeStorage } from '../platform/storage';
import { CORPUS_DATA } from '../state/corpus-token';
import { TopicList } from './topic-list';

const DATA: Corpus = {
  generatedAt: '2026-08-06T00:00:00Z',
  decks: [
    { id: 'a', name: 'Alpha', lines: ['a1', 'a2'] },
    { id: 'b', name: 'Beta', lines: ['b1'] },
  ],
};

@Component({
  imports: [TopicList],
  template: `<aside appTopicList></aside>`,
})
class Host {}

function render() {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      {
        provide: SafeStorage,
        useValue: { read: () => null, write: () => {} } as unknown as SafeStorage,
      },
      { provide: CORPUS_DATA, useValue: DATA },
    ],
  });
  const fixture = TestBed.createComponent(Host);
  fixture.detectChanges();
  return {
    fixture,
    sidebar: (fixture.nativeElement as HTMLElement).querySelector('.sidebar')!,
  };
}

describe('TopicList', () => {
  it('renders as an <aside class="sidebar">', () => {
    const { sidebar } = render();
    expect(sidebar.tagName).toBe('ASIDE');
    expect(sidebar.classList.contains('sidebar')).toBe(true);
  });

  it('keeps the Topics heading and the labelled nav the stylesheet targets', () => {
    const { sidebar } = render();
    expect(sidebar.querySelector('.topics-title')?.textContent).toBe('Topics');
    const nav = sidebar.querySelector('nav.decks');
    expect(nav?.id).toBe('decks');
    expect(nav?.getAttribute('aria-label')).toBe('Topics');
    expect(nav?.querySelector('.decks-list')).not.toBeNull();
  });

  it('renders All first, then every deck with its count', () => {
    const { sidebar } = render();
    const buttons = [...sidebar.querySelectorAll<HTMLButtonElement>('#decks button')];
    expect(buttons.length).toBe(3);
    expect(buttons.map((b) => b.querySelector('span')?.textContent))
      .toEqual(['All', 'Alpha', 'Beta']);
    expect(buttons.map((b) => b.querySelector('.count')?.textContent))
      .toEqual(['3', '2', '1']);
  });

  it('marks the selected deck with aria-current', () => {
    const { fixture, sidebar } = render();
    const buttons = [...sidebar.querySelectorAll<HTMLButtonElement>('#decks button')];
    expect(buttons[0].getAttribute('aria-current')).toBe('true');

    buttons[2].click();
    fixture.detectChanges();
    expect(buttons[0].getAttribute('aria-current')).toBe('false');
    expect(buttons[2].getAttribute('aria-current')).toBe('true');
  });
});
