import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { RANDOM } from '../platform/rng';
import { SafeStorage } from '../platform/storage';
import { CATALOG } from '../state/catalog-token';
import { PracticeStore } from '../state/practice-store';
import { NO_SHUFFLE, signedOutBackend, TEST_CATALOG } from '../testing/catalog';
import { LevelPicker } from './level-picker';

@Component({
  imports: [LevelPicker],
  template: `<div appLevelPicker></div>`,
})
class Host {}

function render() {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      ...signedOutBackend(),
      {
        provide: SafeStorage,
        useValue: { read: () => null, write: () => {} } as unknown as SafeStorage,
      },
      { provide: CATALOG, useValue: TEST_CATALOG },
      { provide: RANDOM, useValue: NO_SHUFFLE },
    ],
  });
  const fixture = TestBed.createComponent(Host);
  fixture.detectChanges();
  const root = (fixture.nativeElement as HTMLElement).querySelector('.level-picker')!;
  return {
    fixture,
    root,
    practice: TestBed.inject(PracticeStore),
    cards: () => [...root.querySelectorAll<HTMLButtonElement>('.level-card')],
  };
}

describe('LevelPicker', () => {
  it('asks the question and says the choice is not final', () => {
    const { root } = render();
    expect(root.querySelector('.level-title')?.textContent).toBe('Choose your level');
    expect(root.querySelector('.level-lede')?.textContent).toMatch(/change this at any time/i);
  });

  it('shows every level in the catalog, including the empty ones', () => {
    const { cards } = render();
    expect(cards().map((c) => c.dataset['levelId'])).toEqual(['A2', 'B1', 'C2']);
  });

  it('describes each level in the learner\'s terms, not in counts', () => {
    const { cards } = render();
    expect(cards()[0].textContent).toMatch(/You can handle everyday phrases/);
    expect(cards()[1].textContent).toMatch(/You can cope with familiar subjects/);
    expect(cards()[0].textContent).not.toMatch(/\d+ sentences/);
    expect(cards()[0].textContent).not.toMatch(/topic/i);
  });

  it('disables a level with nothing behind it rather than hiding it', () => {
    const { cards } = render();
    const empty = cards()[2];
    expect(empty.disabled).toBe(true);
    expect(empty.textContent).toMatch(/coming soon/i);
    expect(empty.title).toMatch(/not ready yet/i);
  });

  it('choosing a level starts practice at it', () => {
    const { fixture, cards, practice } = render();
    expect(practice.levelChosen()).toBe(false);

    cards()[0].click();
    fixture.detectChanges();

    expect(practice.level()).toBe('A2');
    expect(practice.levelChosen()).toBe(true);
    expect(practice.lines()).toEqual(['a1', 'a2', 'a3', 'b1']);
  });

  it('a disabled level cannot be chosen by clicking it', () => {
    const { fixture, cards, practice } = render();
    cards()[2].click();
    fixture.detectChanges();
    expect(practice.levelChosen()).toBe(false);
  });

  it('marks the level already in use', () => {
    const { fixture, cards } = render();
    cards()[1].click();
    fixture.detectChanges();
    expect(cards()[1].getAttribute('aria-current')).toBe('true');
    expect(cards()[0].getAttribute('aria-current')).toBe('false');
  });

  it('choosing a level leaves the topic filter open, showing everything', () => {
    const { fixture, cards, practice } = render();
    cards()[0].click();
    fixture.detectChanges();
    expect(practice.topicId()).toBeNull();
    expect(practice.topics().map((t) => t.id)).toEqual(['a', 'b']);
  });
});
