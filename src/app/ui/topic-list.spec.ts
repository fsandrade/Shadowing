import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { RANDOM } from '../platform/rng';
import { SafeStorage } from '../platform/storage';
import { CATALOG } from '../state/catalog-token';
import { PracticeStore } from '../state/practice-store';
import { NO_SHUFFLE, storedSettings, TEST_CATALOG } from '../testing/catalog';
import { TopicList } from './topic-list';

const DATA = TEST_CATALOG;

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
        useValue: storedSettings() as unknown as SafeStorage,
      },
      { provide: CATALOG, useValue: DATA },
      { provide: RANDOM, useValue: NO_SHUFFLE },
    ],
  });
  const fixture = TestBed.createComponent(Host);
  fixture.detectChanges();
  const sidebar = (fixture.nativeElement as HTMLElement).querySelector('.sidebar')!;
  return {
    fixture,
    sidebar,
    practice: TestBed.inject(PracticeStore),
    topicButtons: () =>
      [...sidebar.querySelectorAll<HTMLButtonElement>('#decks button')],
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

    expect(nav?.getAttribute('aria-label')).toBe('Filter by topic');
    expect(nav?.querySelector('.decks-list')).not.toBeNull();
  });

  it('lists only the topics present at the chosen level, with no All entry', () => {
    const { topicButtons } = render();

    expect(topicButtons().map((b) => b.textContent?.trim())).toEqual(['A', 'B']);
  });

  it('shows no line counts', () => {
    const { sidebar } = render();
    expect(sidebar.querySelectorAll('.count').length).toBe(0);
    expect(sidebar.querySelector('#decks')?.textContent).not.toMatch(/\d/);
  });

  it('starts unfiltered, with no topic pressed', () => {
    const { topicButtons, practice } = render();
    expect(practice.topicId()).toBeNull();
    expect(topicButtons().every((b) => b.getAttribute('aria-pressed') === 'false')).toBe(true);
  });

  it('filters to one topic, and the same click again clears the filter', () => {
    const { fixture, topicButtons, practice } = render();

    topicButtons()[0].click();
    fixture.detectChanges();
    expect(practice.topicId()).toBe('a');
    expect(topicButtons()[0].getAttribute('aria-pressed')).toBe('true');
    expect(topicButtons()[1].getAttribute('aria-pressed')).toBe('false');
    expect(practice.lines()).toEqual(['a1', 'a2', 'a3']);

    topicButtons()[0].click();
    fixture.detectChanges();
    expect(practice.topicId()).toBeNull();
    expect(topicButtons()[0].getAttribute('aria-pressed')).toBe('false');
    expect(practice.lines()).toEqual(['a1', 'a2', 'a3', 'b1']);
  });

  it('keeps My text out of the filter, as its own mode', () => {
    const { fixture, sidebar, practice, topicButtons } = render();
    const myText = sidebar.querySelector<HTMLButtonElement>('#myText')!;

    expect(topicButtons().map((b) => b.id)).not.toContain('myText');
    expect(myText.getAttribute('aria-pressed')).toBe('false');

    myText.click();
    fixture.detectChanges();
    expect(practice.customActive()).toBe(true);
    expect(myText.getAttribute('aria-pressed')).toBe('true');

    myText.click();
    fixture.detectChanges();
    expect(practice.customActive()).toBe(false);
  });
});
