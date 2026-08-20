import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { CUSTOM_TEXT_LIMIT } from '../core/sentences';
import { SafeStorage } from '../platform/storage';
import { CATALOG } from '../state/catalog-token';
import { CustomTopicStore } from '../state/custom-topic-store';
import { PracticeStore } from '../state/practice-store';
import { CustomTopic } from './custom-topic';
import { NO_SHUFFLE, TEST_CATALOG } from '../testing/catalog';
import { RANDOM } from '../platform/rng';

const DATA = TEST_CATALOG;

@Component({
  imports: [CustomTopic],
  template: `<div appCustomTopic></div>`,
})
class Host {}

function render(stored: unknown = null) {
  const written = new Map<string, unknown>();
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: CATALOG, useValue: DATA },
      { provide: RANDOM, useValue: NO_SHUFFLE },
      {
        provide: SafeStorage,
        useValue: {
          read: (key: string) => (key === 'shadowing.customTopic' ? stored : null),
          write: (key: string, value: unknown) => written.set(key, value),
        } as unknown as SafeStorage,
      },
    ],
  });
  const practice = TestBed.inject(PracticeStore);
  practice.useCustomText();

  const fixture = TestBed.createComponent(Host);
  fixture.detectChanges();
  const root = fixture.nativeElement as HTMLElement;
  return {
    fixture,
    written,
    practice,
    custom: TestBed.inject(CustomTopicStore),
    panel: root.querySelector('.custom-topic')!,
    area: () => root.querySelector('textarea'),
    btn: (id: string) => root.querySelector(`#${id}`) as HTMLButtonElement | null,
    type: (value: string) => {
      const area = root.querySelector('textarea')!;
      area.value = value;
      area.dispatchEvent(new Event('input'));
      fixture.detectChanges();
    },
  };
}

describe('CustomTopic when there is no text yet', () => {
  it('shows the editor', () => {
    const { area, btn } = render();
    expect(area()).not.toBeNull();
    expect(btn('customSave')).not.toBeNull();
  });

  it('cannot save nothing', () => {
    const { btn, type } = render();
    expect(btn('customSave')!.disabled).toBe(true);

    type('   ');
    expect(btn('customSave')!.disabled).toBe(true);

    type('Something real.');
    expect(btn('customSave')!.disabled).toBe(false);
  });

  it('offers no cancel, because there is nothing to go back to', () => {
    expect(render().btn('customCancel')).toBeNull();
  });

  it('counts the characters left', () => {
    const { panel, type } = render();
    type('12345');
    expect(panel.querySelector('.custom-count')?.textContent)
      .toContain(String(CUSTOM_TEXT_LIMIT - 5));
  });

  it('caps typing at the limit', () => {
    const { panel, type } = render();
    type('x'.repeat(CUSTOM_TEXT_LIMIT + 100));
    expect(panel.querySelector('.custom-count')?.textContent).toContain('0 characters left');
  });
});

describe('CustomTopic saving', () => {
  it('turns the text into practice lines', () => {
    const { btn, type, practice } = render();
    type('First one. Second one!');
    btn('customSave')!.click();

    expect(practice.lines()).toEqual(['First one.', 'Second one!']);
  });

  it('collapses to a summary once saved', () => {
    const { fixture, btn, type, area, panel } = render();
    type('First one. Second one!');
    btn('customSave')!.click();
    fixture.detectChanges();

    expect(area()).toBeNull();
    expect(panel.querySelector('.custom-summary')).not.toBeNull();
    expect(panel.textContent).toContain('2 sentences');
  });

  it('strips markup before it ever becomes a line', () => {
    const { btn, type, practice } = render();
    type('<script>alert(1)</script>Clean one. <b>Bold</b> two.');
    btn('customSave')!.click();

    expect(practice.lines()).toEqual(['Clean one.', 'Bold two.']);
    expect(practice.lines().join(' ')).not.toContain('<');
  });

  it('persists the sanitised text', () => {
    const { btn, type, written } = render();
    type('<i>Keep</i> this.');
    btn('customSave')!.click();

    expect(written.get('shadowing.customTopic')).toBe('Keep this.');
  });

  it('resets progress so a stale index cannot outlive the old text', () => {
    const { fixture, btn, type, practice } = render('One. Two. Three. Four.');
    practice.goTo(3);
    expect(practice.index()).toBe(3);

    btn('customEdit')!.click();
    fixture.detectChanges();
    type('Only one now.');
    btn('customSave')!.click();
    fixture.detectChanges();

    expect(practice.lines()).toEqual(['Only one now.']);
    expect(practice.index()).toBe(0);
  });
});

describe('CustomTopic with saved text', () => {
  it('opens on the summary, not the editor', () => {
    const { area, panel, btn } = render('Stored one. Stored two.');
    expect(area()).toBeNull();
    expect(panel.textContent).toContain('2 sentences');
    expect(btn('customEdit')).not.toBeNull();
    expect(btn('customClear')).not.toBeNull();
  });

  it('edit reopens the editor pre-filled', () => {
    const { fixture, btn, area } = render('Stored one.');
    btn('customEdit')!.click();
    fixture.detectChanges();

    expect(area()).not.toBeNull();
    expect(area()!.value).toBe('Stored one.');
  });

  it('cancel leaves the saved text alone', () => {
    const { fixture, btn, type, practice } = render('Stored one.');
    btn('customEdit')!.click();
    fixture.detectChanges();

    type('Replaced.');
    btn('customCancel')!.click();
    fixture.detectChanges();

    expect(practice.lines()).toEqual(['Stored one.']);
  });

  it('clear empties the deck and storage', () => {
    const { fixture, btn, practice, written, area } = render('Stored one.');
    btn('customClear')!.click();
    fixture.detectChanges();

    expect(practice.lines()).toEqual([]);
    expect(written.get('shadowing.customTopic')).toBe('');
    expect(area()).not.toBeNull();
  });
});
