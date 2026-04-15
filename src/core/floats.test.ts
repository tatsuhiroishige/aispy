import { describe, it, expect } from 'vitest';
import { ExclusionList, isFloated, clearValue } from './floats.js';

describe('ExclusionList', () => {
  it('empty list returns full width', () => {
    const ex = new ExclusionList();
    expect(ex.availableAt(0, 80)).toEqual({ x: 0, width: 80 });
    expect(ex.availableAt(100, 80)).toEqual({ x: 0, width: 80 });
  });

  it('left float shrinks available width from the start', () => {
    const ex = new ExclusionList();
    ex.add({ side: 'left', top: 0, bottom: 5, width: 20 });
    expect(ex.availableAt(2, 80)).toEqual({ x: 20, width: 60 });
    // Outside the float band: full width
    expect(ex.availableAt(5, 80)).toEqual({ x: 0, width: 80 });
  });

  it('right float shrinks available width from the end', () => {
    const ex = new ExclusionList();
    ex.add({ side: 'right', top: 0, bottom: 10, width: 25 });
    expect(ex.availableAt(0, 80)).toEqual({ x: 0, width: 55 });
  });

  it('left + right floats at same y both eat width', () => {
    const ex = new ExclusionList();
    ex.add({ side: 'left', top: 0, bottom: 10, width: 20 });
    ex.add({ side: 'right', top: 0, bottom: 10, width: 30 });
    expect(ex.availableAt(5, 100)).toEqual({ x: 20, width: 50 });
  });

  it('findFitY stays at startY when block fits', () => {
    const ex = new ExclusionList();
    ex.add({ side: 'right', top: 0, bottom: 10, width: 30 });
    expect(ex.findFitY(0, 70, 100)).toBe(0);
  });

  it('findFitY jumps past exclusion when block does not fit', () => {
    const ex = new ExclusionList();
    ex.add({ side: 'right', top: 0, bottom: 10, width: 60 });
    // Need 50 but only 40 available at y=0
    expect(ex.findFitY(0, 50, 100)).toBe(10);
  });

  it('clearY for both jumps past all exclusions', () => {
    const ex = new ExclusionList();
    ex.add({ side: 'left', top: 0, bottom: 5, width: 20 });
    ex.add({ side: 'right', top: 3, bottom: 12, width: 20 });
    expect(ex.clearY(0, 'both')).toBe(12);
    expect(ex.clearY(0, 'left')).toBe(5);
    expect(ex.clearY(0, 'right')).toBe(12);
  });

  it('maxBottom returns the lowest edge', () => {
    const ex = new ExclusionList();
    ex.add({ side: 'left', top: 0, bottom: 5, width: 10 });
    ex.add({ side: 'right', top: 2, bottom: 8, width: 10 });
    expect(ex.maxBottom()).toBe(8);
  });
});

describe('isFloated / clearValue', () => {
  it('detects float', () => {
    expect(isFloated({ computed: { float: 'left' } })).toBe(true);
    expect(isFloated({ computed: { float: 'right' } })).toBe(true);
    expect(isFloated({ computed: { float: 'none' } })).toBe(false);
    expect(isFloated({ computed: {} })).toBe(false);
  });

  it('reads clear', () => {
    expect(clearValue({ computed: { clear: 'both' } })).toBe('both');
    expect(clearValue({ computed: {} })).toBe('none');
  });
});
