import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { createStyleResolver } from './cssResolver.js';
import { buildBoxTree } from './buildBoxTree.js';
import { layout, createLayoutContext, createInitialInput, getLayoutState } from './layout.js';
import type { Box } from './boxTree.js';

function renderLayout(html: string, width = 80) {
  const doc = new JSDOM(html).window.document;
  const root = buildBoxTree(doc, createStyleResolver(doc));
  const ctx = createLayoutContext(1, 1, 10, 20);
  layout(ctx, root, { x: 0, y: 0 }, createInitialInput(width));
  return root;
}

function findByClass(root: Box, className: string): Box | null {
  if (
    root.element &&
    typeof root.element.className === 'string' &&
    root.element.className.split(/\s+/).includes(className)
  ) return root;
  for (const c of root.children) {
    const found = findByClass(c, className);
    if (found) return found;
  }
  return null;
}

function findText(root: Box, substr: string): Box | null {
  if (root.kind === 'inline-text' && root.text.includes(substr)) return root;
  for (const c of root.children) {
    const f = findText(c, substr);
    if (f) return f;
  }
  return null;
}

describe('Class-based style defaults', () => {
  it('applies float:right to .infobox tables', () => {
    const resolver = createStyleResolver(
      new JSDOM('<body><table class="infobox"></table></body>').window.document,
    );
    const doc = new JSDOM('<body><table class="infobox"></table></body>').window.document;
    const style = resolver.getComputedStyle(doc.querySelector('table')!);
    expect(style.float).toBe('right');
    expect(style.borderStyle).toBe('solid');
  });

  it('applies yellow bg to .hatnote', () => {
    const doc = new JSDOM('<body><div class="hatnote">note</div></body>').window.document;
    const resolver = createStyleResolver(doc);
    const style = resolver.getComputedStyle(doc.querySelector('div')!);
    expect(style.backgroundColor).toBeTruthy();
  });

  it('applies border to .wikitable', () => {
    const doc = new JSDOM('<body><table class="wikitable"></table></body>').window.document;
    const resolver = createStyleResolver(doc);
    const style = resolver.getComputedStyle(doc.querySelector('table')!);
    expect(style.borderStyle).toBe('solid');
  });

  it('infobox actually positions at right edge of container', () => {
    const root = renderLayout(
      `<body>
        <div>
          <table class="infobox"><tbody><tr><td>info</td></tr></tbody></table>
          <p>main content</p>
        </div>
      </body>`,
      80,
    );
    const infobox = findByClass(root, 'infobox')!;
    const state = getLayoutState(infobox)!;
    // Right edge should be close to the container's right (80)
    expect(state.offset.x + state.size.width).toBeGreaterThan(50);
  });

  it('inline style overrides class defaults', () => {
    const doc = new JSDOM(
      '<body><table class="infobox" style="float: none"></table></body>',
    ).window.document;
    const resolver = createStyleResolver(doc);
    const style = resolver.getComputedStyle(doc.querySelector('table')!);
    expect(style.float).toBe('none');
  });
});

describe('Wikipedia TOC / clutter skip', () => {
  it('skips <div class="toc">', () => {
    const root = renderLayout(
      `<body>
        <h1>Article</h1>
        <div class="toc"><ul><li>内部リンク</li></ul></div>
        <p>intro text</p>
      </body>`,
      80,
    );
    expect(findText(root, '内部リンク')).toBeNull();
    expect(findText(root, 'intro text')).not.toBeNull();
  });

  it('skips <div id="toc">', () => {
    const root = renderLayout(
      `<body><div id="toc"><p>nav</p></div><p>article body</p></body>`,
      80,
    );
    expect(findText(root, 'nav')).toBeNull();
    expect(findText(root, 'article body')).not.toBeNull();
  });

  it('skips mw-editsection [edit] links', () => {
    const root = renderLayout(
      `<body><h2>Section<span class="mw-editsection">[edit]</span></h2><p>body</p></body>`,
      80,
    );
    expect(findText(root, '[edit]')).toBeNull();
    expect(findText(root, 'Section')).not.toBeNull();
  });
});
