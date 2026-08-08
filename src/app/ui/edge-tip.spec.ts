import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { SafeStorage } from '../platform/storage';
import { EDGE_TIP_KEY, EdgeTip, IS_EDGE, POINTER_IS_FINE } from './edge-tip';

/** Rendered through real markup so the host stays a <div class="snackbar">. */
@Component({
  imports: [EdgeTip],
  template: `<div appEdgeTip></div>`,
})
class Host {}

function render(opts: {
  isEdge?: boolean; fine?: boolean; stored?: unknown;
} = {}) {
  const write = vi.fn();
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: IS_EDGE, useValue: opts.isEdge ?? false },
      { provide: POINTER_IS_FINE, useValue: opts.fine ?? true },
      {
        provide: SafeStorage,
        useValue: {
          read: () => opts.stored ?? null,
          write,
        } as unknown as SafeStorage,
      },
    ],
  });
  const fixture = TestBed.createComponent(Host);
  fixture.detectChanges();
  return {
    fixture,
    snackbar: (fixture.nativeElement as HTMLElement).querySelector('.snackbar')!,
    write,
  };
}

describe('EdgeTip visibility', () => {
  it('shows on a non-Edge desktop browser that has not been tipped', () => {
    expect(render().snackbar.classList.contains('show')).toBe(true);
  });

  it('stays hidden in Edge', () => {
    expect(render({ isEdge: true }).snackbar.classList.contains('show')).toBe(false);
  });

  it('stays hidden on coarse pointers', () => {
    expect(render({ fine: false }).snackbar.classList.contains('show')).toBe(false);
  });

  it('stays hidden once dismissed in an earlier session', () => {
    expect(render({ stored: '1' }).snackbar.classList.contains('show')).toBe(false);
  });

  it('honours a bare 1 written by the vanilla app', () => {
    // SafeStorage JSON-parses, so the vanilla app's bare `1` comes back as 1.
    expect(render({ stored: 1 }).snackbar.classList.contains('show')).toBe(false);
  });
});

describe('EdgeTip structure', () => {
  it('renders as <div class="snackbar" id="snackbar">', () => {
    const { snackbar } = render();
    expect(snackbar.classList.contains('snackbar')).toBe(true);
    expect(snackbar.id).toBe('snackbar');
  });

  it('mentions Edge and links with the microsoft-edge scheme', () => {
    const { snackbar } = render();
    expect(snackbar.textContent).toMatch(/Edge/i);
    expect(snackbar.querySelector<HTMLAnchorElement>('#edge-link')!
      .getAttribute('href')).toMatch(/^microsoft-edge:/);
  });

  it('has a labelled dismiss button', () => {
    expect(render().snackbar.querySelector('.snackbar-close')
      ?.getAttribute('aria-label')).toBe('Dismiss');
  });
});

describe('EdgeTip dismissal', () => {
  it('closing remembers the choice under the vanilla key', () => {
    const { fixture, snackbar, write } = render();
    snackbar.querySelector<HTMLButtonElement>('.snackbar-close')!.click();
    fixture.detectChanges();

    expect(snackbar.classList.contains('show')).toBe(false);
    expect(write).toHaveBeenCalledWith(EDGE_TIP_KEY, '1');
  });

  it('exposes the storage key the vanilla app used', () => {
    expect(EDGE_TIP_KEY).toBe('shadowing.edgeTip');
  });
});
