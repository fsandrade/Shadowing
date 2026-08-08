import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { HelpModal } from './help-modal';

@Component({
  imports: [HelpModal],
  template: `
    <button id="opener">open</button>
    <div appHelpModal [open]="open()" (close)="closed = closed + 1"></div>
  `,
})
class Host {
  readonly open = signal(false);
  closed = 0;
}

function render(open: boolean) {
  TestBed.resetTestingModule();
  const fixture = TestBed.createComponent(Host);
  fixture.componentInstance.open.set(open);
  fixture.detectChanges();
  const root = fixture.nativeElement as HTMLElement;
  return { fixture, host: fixture.componentInstance, modal: root.querySelector('.modal')! };
}

describe('HelpModal structure', () => {
  it('renders as the dialog the stylesheet and specs target', () => {
    const { modal } = render(false);
    expect(modal.classList.contains('modal')).toBe(true);
    expect(modal.id).toBe('helpModal');
    expect(modal.getAttribute('role')).toBe('dialog');
    expect(modal.getAttribute('aria-modal')).toBe('true');
    expect(modal.getAttribute('aria-labelledby')).toBe('helpTitle');
  });

  it('adds the show class only when open', () => {
    expect(render(false).modal.classList.contains('show')).toBe(false);
    expect(render(true).modal.classList.contains('show')).toBe(true);
  });

  it('keeps the panel structure and the titled heading', () => {
    const { modal } = render(true);
    expect(modal.querySelector('.modal-panel')).not.toBeNull();
    expect(modal.querySelector('#helpTitle')?.textContent).toBe('How to use this app');
    expect(modal.querySelector('#helpClose')?.getAttribute('aria-label')).toBe('Close help');
  });
});

describe('HelpModal content', () => {
  it('documents every feature the spec checks for', () => {
    const text = render(true).modal.textContent ?? '';
    for (const term of ['How to use this app', 'Blur', 'gap', 'speed', 'voice',
                        'Shuffle', 'Play / Pause', 'Next', 'Session']) {
      expect(text, `help should mention ${term}`).toContain(term);
    }
  });
});

describe('HelpModal dismissal', () => {
  it('the close button emits close', () => {
    const { host, modal } = render(true);
    modal.querySelector<HTMLButtonElement>('#helpClose')!.click();
    expect(host.closed).toBe(1);
  });

  it('clicking the backdrop emits close', () => {
    const { host, modal } = render(true);
    (modal as HTMLElement).click();
    expect(host.closed).toBe(1);
  });

  it('clicking inside the panel does not emit close', () => {
    const { host, modal } = render(true);
    modal.querySelector<HTMLElement>('.modal-panel')!.click();
    expect(host.closed).toBe(0);
  });
});

describe('HelpModal focus', () => {
  it('focuses the close button on open and restores focus on dismiss', () => {
    const { fixture, host } = render(false);
    const root = fixture.nativeElement as HTMLElement;

    document.body.appendChild(root);
    const opener = root.querySelector<HTMLButtonElement>('#opener')!;
    opener.focus();
    expect(document.activeElement).toBe(opener);

    host.open.set(true);
    fixture.detectChanges();
    expect(document.activeElement).toBe(root.querySelector('#helpClose'));

    host.open.set(false);
    fixture.detectChanges();
    expect(document.activeElement).toBe(opener);

    root.remove();
  });
});
