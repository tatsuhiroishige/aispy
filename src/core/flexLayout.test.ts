import { describe, it, expect } from 'vitest';
import { calculateFlexLayout } from './flexLayout.js';
import type { FlexItem } from './flexLayout.js';

describe('calculateFlexLayout', () => {
  it('single child fills container width', () => {
    const root: FlexItem = {
      flexDirection: 'row',
      children: [{ flexGrow: 1 }],
    };
    const result = calculateFlexLayout(root, 100, 50);

    expect(result.width).toBe(100);
    expect(result.height).toBe(50);
    expect(result.children).toHaveLength(1);
    expect(result.children[0]!.width).toBe(100);
    expect(result.children[0]!.height).toBe(50);
  });

  it('two children with equal flex-grow split width 50/50', () => {
    const root: FlexItem = {
      flexDirection: 'row',
      children: [{ flexGrow: 1 }, { flexGrow: 1 }],
    };
    const result = calculateFlexLayout(root, 100, 50);

    expect(result.children).toHaveLength(2);
    expect(result.children[0]!.width).toBe(50);
    expect(result.children[1]!.width).toBe(50);
    expect(result.children[0]!.x).toBe(0);
    expect(result.children[1]!.x).toBe(50);
  });

  it('three children with flex-grow 1:2:1 split proportionally', () => {
    const root: FlexItem = {
      flexDirection: 'row',
      children: [{ flexGrow: 1 }, { flexGrow: 2 }, { flexGrow: 1 }],
    };
    const result = calculateFlexLayout(root, 100, 40);

    expect(result.children).toHaveLength(3);
    expect(result.children[0]!.width).toBe(25);
    expect(result.children[1]!.width).toBe(50);
    expect(result.children[2]!.width).toBe(25);
    expect(result.children[0]!.x).toBe(0);
    expect(result.children[1]!.x).toBe(25);
    expect(result.children[2]!.x).toBe(75);
  });

  it('column direction stacks vertically', () => {
    const root: FlexItem = {
      flexDirection: 'column',
      children: [{ flexGrow: 1 }, { flexGrow: 1 }],
    };
    const result = calculateFlexLayout(root, 80, 100);

    expect(result.children).toHaveLength(2);
    expect(result.children[0]!.height).toBe(50);
    expect(result.children[1]!.height).toBe(50);
    expect(result.children[0]!.y).toBe(0);
    expect(result.children[1]!.y).toBe(50);
    // Both children stretch to full container width in column mode
    expect(result.children[0]!.width).toBe(80);
    expect(result.children[1]!.width).toBe(80);
  });

  it('fixed width child + flex-grow child fills remaining', () => {
    const root: FlexItem = {
      flexDirection: 'row',
      children: [{ width: 30 }, { flexGrow: 1 }],
    };
    const result = calculateFlexLayout(root, 100, 50);

    expect(result.children).toHaveLength(2);
    expect(result.children[0]!.width).toBe(30);
    expect(result.children[0]!.x).toBe(0);
    expect(result.children[1]!.width).toBe(70);
    expect(result.children[1]!.x).toBe(30);
  });

  it('nested flex containers work correctly', () => {
    const root: FlexItem = {
      flexDirection: 'row',
      children: [
        {
          flexGrow: 1,
          flexDirection: 'column',
          children: [{ flexGrow: 1 }, { flexGrow: 1 }],
        },
        { flexGrow: 1 },
      ],
    };
    const result = calculateFlexLayout(root, 100, 80);

    expect(result.children[0]!.width).toBe(50);
    expect(result.children[1]!.width).toBe(50);
    // Nested column children split vertically
    const nested = result.children[0]!.children;
    expect(nested).toHaveLength(2);
    expect(nested[0]!.height).toBe(40);
    expect(nested[1]!.height).toBe(40);
    expect(nested[0]!.y).toBe(0);
    expect(nested[1]!.y).toBe(40);
  });

  it('returns correct layout for no children', () => {
    const root: FlexItem = {};
    const result = calculateFlexLayout(root, 120, 60);

    expect(result.width).toBe(120);
    expect(result.height).toBe(60);
    expect(result.children).toHaveLength(0);
  });
});
