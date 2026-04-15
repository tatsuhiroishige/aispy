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

function layoutFromHtml(html: string, width = 80) {
  const doc = new JSDOM(html).window.document;
  const resolver = createStyleResolver(doc);
  const root = buildBoxTree(doc, resolver);
  const ctx = createLayoutContext();
  const input = createInitialInput(width);
  layout(ctx, root, { x: 0, y: 0 }, input);
  return root;
}

describe('layout dispatcher (skeleton)', () => {
  it('populates layout state on root', () => {
    const root = layoutFromHtml('<p>hello</p>', 80);
    const state = getLayoutState(root);
    expect(state).toBeDefined();
    expect(state?.offset).toEqual({ x: 0, y: 0 });
    expect(state?.size.width).toBe(80);
  });

  it('populates state on every block descendant', () => {
    const root = layoutFromHtml('<div><p>a</p><p>b</p></div>', 80);
    // Block layout populates state on block boxes; inline boxes get state in IFC (3.5.4)
    function visit(box: typeof root): void {
      if (box.kind === 'block') {
        expect(getLayoutState(box)).toBeDefined();
      }
      for (const child of box.children) visit(child as typeof root);
    }
    visit(root);
  });

  it('offset x matches input offset for root chain', () => {
    const root = layoutFromHtml('<p>x</p>', 40);
    const state = getLayoutState(root);
    expect(state?.offset.x).toBe(0);
  });

  it('skeleton passes width through to children', () => {
    const root = layoutFromHtml('<p>hi</p>', 60);
    const p = root.children[0]!;
    const pState = getLayoutState(p);
    expect(pState?.size.width).toBe(60);
  });
});
