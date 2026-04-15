import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { createStyleResolver } from './cssResolver.js';
import { buildBoxTree } from './buildBoxTree.js';
import {
  layout,
  createLayoutContext,
  createInitialInput,
  getLayoutState,
} from './layout.js';
import type { Box } from './boxTree.js';

function layoutFromHtml(html: string, width = 80) {
  const doc = new JSDOM(html).window.document;
  const resolver = createStyleResolver(doc);
  const root = buildBoxTree(doc, resolver);
  const ctx = createLayoutContext();
  layout(ctx, root, { x: 0, y: 0 }, createInitialInput(width));
  return root;
}

function childAt(box: Box, ...indices: number[]): Box {
  let cur = box;
  for (const i of indices) {
    const next = cur.children[i];
    if (!next) throw new Error(`no child at ${i}`);
    cur = next;
  }
  return cur;
}

describe('Block formatting context', () => {
  it('stacks block children vertically', () => {
    const root = layoutFromHtml('<div><p>a</p><p>b</p></div>', 80);
    const div = childAt(root, 0);
    const p1 = div.children[0]!;
    const p2 = div.children[1]!;
    const s1 = getLayoutState(p1)!;
    const s2 = getLayoutState(p2)!;
    expect(s2.offset.y).toBeGreaterThan(s1.offset.y);
    expect(s2.offset.y).toBeGreaterThanOrEqual(s1.offset.y + s1.size.height);
  });

  it('applies margin-top offsetting children', () => {
    const root = layoutFromHtml(
      '<div><p style="margin-top:0">a</p><p style="margin-top:16px">b</p></div>',
      80,
    );
    const div = childAt(root, 0);
    const p2 = div.children[1]!;
    const s2 = getLayoutState(p2)!;
    // marginTop of 16px → ~2 cells (at 8px/cell)
    expect(s2.offset.y).toBeGreaterThanOrEqual(2);
  });

  it('applies padding-left to content width', () => {
    const root = layoutFromHtml('<div style="padding-left:16px"><p>text</p></div>', 80);
    const div = childAt(root, 0);
    const p = div.children[0]!;
    const pState = getLayoutState(p)!;
    expect(pState.offset.x).toBeGreaterThan(0);
    expect(pState.size.width).toBeLessThan(80);
  });

  it('gives inline-only block non-zero height', () => {
    const root = layoutFromHtml('<p>hello world this is some text</p>', 20);
    const p = childAt(root, 0);
    const s = getLayoutState(p)!;
    expect(s.size.height).toBeGreaterThanOrEqual(1);
  });

  it('estimates multiple lines for long inline content', () => {
    const longText = 'x'.repeat(300);
    const root = layoutFromHtml(`<p>${longText}</p>`, 20);
    const p = childAt(root, 0);
    const s = getLayoutState(p)!;
    expect(s.size.height).toBeGreaterThanOrEqual(15);
  });

  it('honors <br> as a line break in inline height estimation', () => {
    const root = layoutFromHtml('<p>a<br>b<br>c</p>', 80);
    const p = childAt(root, 0);
    const s = getLayoutState(p)!;
    expect(s.size.height).toBeGreaterThanOrEqual(3);
  });
});
