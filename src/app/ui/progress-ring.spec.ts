import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { ProgressRing, RING_LENGTH } from './progress-ring';

@Component({
  imports: [ProgressRing],
  template: `<svg appProgressRing [progress]="p()"></svg>`,
})
class Host {
  readonly p = signal(0);
}

function render(progress: number) {
  TestBed.resetTestingModule();
  const fixture = TestBed.createComponent(Host);
  fixture.componentInstance.p.set(progress);
  fixture.detectChanges();
  return (fixture.nativeElement as HTMLElement).querySelector('.ring')!;
}

function offsetAt(progress: number): number {
  return Number(
    render(progress).querySelector('circle.ring-fill')!.getAttribute('stroke-dashoffset'),
  );
}

describe('ProgressRing', () => {
  it('renders as an <svg class="ring"> the stylesheet targets', () => {
    const ring = render(0);
    expect(ring.tagName.toLowerCase()).toBe('svg');
    expect(ring.classList.contains('ring')).toBe(true);
    expect(ring.getAttribute('viewBox')).toBe('0 0 20 20');
    expect(ring.getAttribute('width')).toBe('18');
    expect(ring.getAttribute('height')).toBe('18');
    expect(ring.getAttribute('aria-hidden')).toBe('true');
  });

  it('draws a track circle and a fill circle', () => {
    const ring = render(0);
    expect(ring.querySelector('circle.ring-track')).not.toBeNull();
    expect(ring.querySelector('circle.ring-fill')).not.toBeNull();
  });

  it('is fully drained at progress 0', () => {
    expect(offsetAt(0)).toBeCloseTo(RING_LENGTH, 1);
  });

  it('is fully drawn at progress 1', () => {
    expect(offsetAt(1)).toBeCloseTo(0, 1);
  });

  it('offset decreases as progress grows', () => {
    expect(offsetAt(0.75)).toBeLessThan(offsetAt(0.25));
  });
});
