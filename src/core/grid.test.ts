import { describe, it, expect } from 'vitest';
import { _internal } from './grid.js';
import { JSDOM } from 'jsdom';
import { createStyleResolver } from './cssResolver.js';
import { buildBoxTree } from './buildBoxTree.js';
import { layout, createLayoutContext, createInitialInput, getLayoutState } from './layout.js';
import type { Box } from './boxTree.js';

describe('parseTrackList', () => {
  const { parseTrackList } = _internal;

  it('handles repeat', () => {
    const tracks = parseTrackList('repeat(4, 1fr)');
    expect(tracks).toHaveLength(4);
    expect(tracks.every((t) => t.kind === 'fr' && t.value === 1)).toBe(true);
  });

  it('handles mixed fr tokens', () => {
    const tracks = parseTrackList('1fr 2fr 1fr');
    expect(tracks.map((t) => t.value)).toEqual([1, 2, 1]);
  });

  it('handles fixed px values', () => {
    const tracks = parseTrackList('80px 80px');
    expect(tracks[0]).toEqual({ kind: 'fixed', value: 10 });
  });
});

describe('distributeTracks', () => {
  const { distributeTracks } = _internal;

  it('splits equally for repeat(4, 1fr)', () => {
    const w = distributeTracks(
      Array(4).fill({ kind: 'fr' as const, value: 1 }),
      80,
      0,
    );
    expect(w).toEqual([20, 20, 20, 20]);
  });

  it('accounts for gap', () => {
    const w = distributeTracks(
      Array(4).fill({ kind: 'fr' as const, value: 1 }),
      80,
      2,
    );
    // 80 - 3 gaps (6) = 74, /4 = 18
    expect(w).toEqual([18, 18, 18, 18]);
  });

  it('mixes fixed and fr', () => {
    const w = distributeTracks(
      [{ kind: 'fixed', value: 20 }, { kind: 'fr', value: 1 }, { kind: 'fr', value: 1 }],
      80,
      0,
    );
    expect(w[0]).toBe(20);
    expect(w[1]! + w[2]!).toBeLessThanOrEqual(60);
    expect(w[1]).toBe(w[2]);
  });
});

describe('grid integration', () => {
  function findElements(root: Box, tag: string, out: Box[] = []): Box[] {
    if (root.element?.tagName === tag) out.push(root);
    for (const c of root.children) findElements(c, tag, out);
    return out;
  }

  it('places 4 cards in a row with equal widths', () => {
    const html = `
      <div style="display: grid; grid-template-columns: repeat(4, 1fr)">
        <div class="card"><p>A</p></div>
        <div class="card"><p>B</p></div>
        <div class="card"><p>C</p></div>
        <div class="card"><p>D</p></div>
      </div>
    `;
    const doc = new JSDOM(html).window.document;
    const root = buildBoxTree(doc, createStyleResolver(doc));
    const ctx = createLayoutContext(1, 1, 10, 20);
    layout(ctx, root, { x: 0, y: 0 }, createInitialInput(80));

    const cards = findElements(root, 'DIV').filter((c) =>
      (c.element as Element).className === 'card',
    );
    expect(cards).toHaveLength(4);
    // All cards on the same row
    const ys = cards.map((c) => getLayoutState(c)?.offset.y ?? -1);
    expect(new Set(ys).size).toBe(1);
    // Xs are increasing
    const xs = cards.map((c) => getLayoutState(c)?.offset.x ?? -1);
    expect(xs[0]).toBeLessThan(xs[1]!);
    expect(xs[1]).toBeLessThan(xs[2]!);
    expect(xs[2]).toBeLessThan(xs[3]!);
  });

  it('wraps to a second row when more children than columns', () => {
    const html = `
      <div style="display: grid; grid-template-columns: repeat(2, 1fr)">
        <p>A</p><p>B</p><p>C</p><p>D</p>
      </div>
    `;
    const doc = new JSDOM(html).window.document;
    const root = buildBoxTree(doc, createStyleResolver(doc));
    const ctx = createLayoutContext(1, 1, 10, 20);
    layout(ctx, root, { x: 0, y: 0 }, createInitialInput(80));

    const ps = findElements(root, 'P');
    expect(ps).toHaveLength(4);
    const ys = ps.map((p) => getLayoutState(p)!.offset.y);
    // Row 1: A, B — same y; Row 2: C, D — same y > row1
    expect(ys[0]).toBe(ys[1]);
    expect(ys[2]).toBe(ys[3]);
    expect(ys[2]!).toBeGreaterThan(ys[0]!);
  });
});
