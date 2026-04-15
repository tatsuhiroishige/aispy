import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { createStyleResolver } from './cssResolver.js';
import { buildBoxTree } from './buildBoxTree.js';
import type { Box, BlockBox, InlineBox, InlineTextBox, ImageBox } from './boxTree.js';

function parseHtml(html: string): Document {
  return new JSDOM(html).window.document;
}

function buildFromHtml(html: string): BlockBox {
  const doc = parseHtml(html);
  const resolver = createStyleResolver(doc);
  return buildBoxTree(doc, resolver);
}

function childAt(box: Box, ...indices: number[]): Box {
  let cur = box;
  for (const i of indices) {
    const next = cur.children[i];
    if (!next) throw new Error(`No child at index ${i}`);
    cur = next;
  }
  return cur;
}

describe('buildBoxTree', () => {
  it('creates a block root', () => {
    const root = buildFromHtml('<p>hello</p>');
    expect(root.kind).toBe('block');
    expect(root.isAnonymous).toBe(true);
  });

  it('maps <p> to a block box', () => {
    const root = buildFromHtml('<p>hi</p>');
    const p = childAt(root, 0) as BlockBox;
    expect(p.kind).toBe('block');
    expect(p.element?.tagName).toBe('P');
  });

  it('maps <span> to an inline box', () => {
    const root = buildFromHtml('<p><span>x</span></p>');
    const span = childAt(root, 0, 0) as InlineBox;
    expect(span.kind).toBe('inline');
    expect(span.element?.tagName).toBe('SPAN');
  });

  it('creates InlineTextBox for text nodes', () => {
    const root = buildFromHtml('<p>hello</p>');
    const p = childAt(root, 0);
    const text = childAt(p, 0) as InlineTextBox;
    expect(text.kind).toBe('inline-text');
    expect(text.text).toBe('hello');
  });

  it('creates InlineNewlineBox for <br>', () => {
    const root = buildFromHtml('<p>a<br>b</p>');
    const p = childAt(root, 0);
    expect(p.children).toHaveLength(3);
    expect(p.children[1]!.kind).toBe('inline-newline');
  });

  it('creates ImageBox for <img>', () => {
    const root = buildFromHtml('<p><img src="x.png" alt="pic"></p>');
    const img = childAt(root, 0, 0) as ImageBox;
    expect(img.kind).toBe('image');
    expect(img.src).toBe('x.png');
    expect(img.alt).toBe('pic');
  });

  it('skips <script> and <style>', () => {
    const root = buildFromHtml('<p>keep</p><script>x</script><style>.a{}</style>');
    expect(root.children).toHaveLength(1);
    expect((root.children[0] as BlockBox).element?.tagName).toBe('P');
  });

  it('skips display:none via inline style', () => {
    const root = buildFromHtml('<p style="display:none">hidden</p><p>shown</p>');
    expect(root.children).toHaveLength(1);
  });

  it('preserves parent pointers', () => {
    const root = buildFromHtml('<p><span>hi</span></p>');
    const p = childAt(root, 0);
    const span = childAt(p, 0);
    const text = childAt(span, 0);
    expect(span.parent).toBe(p);
    expect(text.parent).toBe(span);
    expect(p.parent).toBe(root);
  });

  it('handles mixed block and inline children (with anon wrapping)', () => {
    const root = buildFromHtml('<div>text<span>inline</span><p>block</p></div>');
    const div = childAt(root, 0);
    // Inlines wrapped in anonymous block (first 2 children), then the real block
    expect(div.children).toHaveLength(2);
    const anon = div.children[0]!;
    expect(anon.kind).toBe('block');
    expect(anon.isAnonymous).toBe(true);
    expect(anon.children[0]!.kind).toBe('inline-text');
    expect(anon.children[1]!.kind).toBe('inline');
    expect(div.children[1]!.kind).toBe('block');
    expect(div.children[1]!.isAnonymous).toBe(false);
  });
});
