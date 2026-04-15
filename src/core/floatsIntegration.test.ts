import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { createStyleResolver } from './cssResolver.js';
import { buildBoxTree } from './buildBoxTree.js';
import { layout, createLayoutContext, createInitialInput, getLayoutState } from './layout.js';
import type { Box } from './boxTree.js';

function renderLayout(html: string, width = 80): ReturnType<typeof buildBoxTree> {
  const doc = new JSDOM(html).window.document;
  const root = buildBoxTree(doc, createStyleResolver(doc));
  const ctx = createLayoutContext(1, 1, 10, 20);
  layout(ctx, root, { x: 0, y: 0 }, createInitialInput(width));
  return root;
}

function findElement(root: Box, tagName: string): Box | null {
  if (root.element?.tagName === tagName) return root;
  for (const c of root.children) {
    const found = findElement(c, tagName);
    if (found) return found;
  }
  return null;
}

describe('Floats layout integration', () => {
  it('float:right positions box at right edge', () => {
    const html = `
      <div style="width: 80">
        <aside style="float: right; width: 20">infobox</aside>
        <p>main content</p>
      </div>
    `;
    const root = renderLayout(html, 80);
    const aside = findElement(root, 'ASIDE')!;
    const state = getLayoutState(aside)!;
    // Right edge of float should be near container right
    expect(state.offset.x + state.size.width).toBeGreaterThanOrEqual(60);
  });

  it('float:left positions box at left edge', () => {
    const html = `
      <div>
        <aside style="float: left; width: 20">sidebar</aside>
        <p>main</p>
      </div>
    `;
    const root = renderLayout(html, 80);
    const aside = findElement(root, 'ASIDE')!;
    const state = getLayoutState(aside)!;
    expect(state.offset.x).toBeLessThanOrEqual(10);
  });

  it('main content is not overlapped by a right float (IFC respects exclusions)', () => {
    const html = `
      <div>
        <aside style="float: right; width: 20">side</aside>
        <p>The quick brown fox jumps over the lazy dog repeatedly</p>
      </div>
    `;
    const root = renderLayout(html, 80);
    const p = findElement(root, 'P')!;
    const pState = getLayoutState(p)!;
    // p's line widths should be shrunk where the float is active
    const lines = pState.lines ?? [];
    if (lines.length > 0) {
      // The first line's atoms should stay within (containerWidth - floatWidth)
      const firstLine = lines[0]!;
      const totalAtomWidth = firstLine.atoms.reduce(
        (acc, a) => Math.max(acc, a.x + a.width),
        0,
      );
      // Container is 80, float is 20 → max usable ~60
      expect(totalAtomWidth).toBeLessThanOrEqual(60);
    }
  });

  it('parent block height contains the float', () => {
    const html = `
      <div>
        <aside style="float: right; width: 10">
          <p>one</p><p>two</p><p>three</p>
        </aside>
        <p>short</p>
      </div>
    `;
    const root = renderLayout(html, 80);
    const div = findElement(root, 'DIV')!;
    const divState = getLayoutState(div)!;
    const aside = findElement(root, 'ASIDE')!;
    const asideState = getLayoutState(aside)!;
    // Parent must extend at least to the aside's bottom
    expect(divState.offset.y + divState.size.height).toBeGreaterThanOrEqual(
      asideState.offset.y + asideState.size.height,
    );
  });

  it('clear: both pushes block below floats', () => {
    const html = `
      <div>
        <aside style="float: right; width: 10">
          <p>a</p><p>b</p><p>c</p><p>d</p><p>e</p>
        </aside>
        <p style="clear: both">After clear</p>
      </div>
    `;
    const root = renderLayout(html, 80);
    const aside = findElement(root, 'ASIDE')!;
    const asideBottom = getLayoutState(aside)!.offset.y + getLayoutState(aside)!.size.height;
    // Find the P that has 'After clear'
    function findAfterClear(b: Box): Box | null {
      if (b.kind === 'inline-text' && b.text.includes('After clear')) {
        // walk up to block
        let cur: Box | null = b;
        while (cur && cur.kind !== 'block') cur = cur.parent;
        return cur;
      }
      for (const c of b.children) {
        const f = findAfterClear(c);
        if (f) return f;
      }
      return null;
    }
    const afterP = findAfterClear(root)!;
    const afterState = getLayoutState(afterP)!;
    expect(afterState.offset.y).toBeGreaterThanOrEqual(asideBottom);
  });
});
