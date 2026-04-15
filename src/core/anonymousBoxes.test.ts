import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { createStyleResolver } from './cssResolver.js';
import { buildBoxTree } from './buildBoxTree.js';
import type { Box, BlockBox } from './boxTree.js';

function buildFromHtml(html: string): BlockBox {
  const doc = new JSDOM(html).window.document;
  return buildBoxTree(doc, createStyleResolver(doc));
}

function childAt(box: Box, ...indices: number[]): Box {
  let cur = box;
  for (const i of indices) {
    const next = cur.children[i];
    if (!next) throw new Error(`No child at ${i}`);
    cur = next;
  }
  return cur;
}

describe('anonymous box generation', () => {
  it('wraps inline siblings of a block in anonymous block', () => {
    const root = buildFromHtml('<div>text<p>block</p>more</div>');
    const div = childAt(root, 0);
    expect(div.children).toHaveLength(3);

    const first = div.children[0]!;
    expect(first.kind).toBe('block');
    expect(first.isAnonymous).toBe(true);
    expect(first.children[0]!.kind).toBe('inline-text');

    const second = div.children[1]!;
    expect(second.kind).toBe('block');
    expect(second.isAnonymous).toBe(false);

    const third = div.children[2]!;
    expect(third.kind).toBe('block');
    expect(third.isAnonymous).toBe(true);
  });

  it('leaves pure-inline children alone', () => {
    const root = buildFromHtml('<p>a<span>b</span>c</p>');
    const p = childAt(root, 0);
    expect(p.children).toHaveLength(3);
    expect(p.children.every((c) => !c.isAnonymous || c.kind === 'inline-text')).toBe(true);
    expect(p.children[0]!.kind).toBe('inline-text');
    expect(p.children[1]!.kind).toBe('inline');
    expect(p.children[2]!.kind).toBe('inline-text');
  });

  it('leaves pure-block children alone', () => {
    const root = buildFromHtml('<div><p>a</p><p>b</p></div>');
    const div = childAt(root, 0);
    expect(div.children).toHaveLength(2);
    for (const c of div.children) {
      expect(c.isAnonymous).toBe(false);
    }
  });

  it('wraps consecutive inline runs as single anonymous block', () => {
    const root = buildFromHtml('<div>a<span>b</span>c<p>block</p>d</div>');
    const div = childAt(root, 0);
    expect(div.children).toHaveLength(3);
    const firstAnon = div.children[0]!;
    expect(firstAnon.kind).toBe('block');
    expect(firstAnon.isAnonymous).toBe(true);
    expect(firstAnon.children).toHaveLength(3);
  });

  it('wraps every inline child in flex container', () => {
    const root = buildFromHtml(
      '<div style="display:flex">a<span>b</span><p>c</p></div>',
    );
    const flex = childAt(root, 0);
    expect(flex.computed.display).toBe('flex');
    expect(flex.children).toHaveLength(2);
    const anon = flex.children[0]!;
    expect(anon.kind).toBe('block');
    expect(anon.isAnonymous).toBe(true);
    expect(anon.children).toHaveLength(2);
    expect(flex.children[1]!.isAnonymous).toBe(false);
  });

  it('preserves parent pointers on anonymous wrappers', () => {
    const root = buildFromHtml('<div>text<p>block</p></div>');
    const div = childAt(root, 0);
    const anon = div.children[0]!;
    expect(anon.parent).toBe(div);
    expect(anon.children[0]!.parent).toBe(anon);
  });

  it('recurses into nested containers', () => {
    const root = buildFromHtml('<div><section>text<p>block</p></section></div>');
    const section = childAt(root, 0, 0);
    expect(section.children).toHaveLength(2);
    expect(section.children[0]!.isAnonymous).toBe(true);
    expect(section.children[1]!.isAnonymous).toBe(false);
  });
});

describe('list-item marker insertion', () => {
  it('prepends disc marker to ul > li', () => {
    const root = buildFromHtml('<ul><li>a</li><li>b</li></ul>');
    const ul = childAt(root, 0);
    for (const li of ul.children) {
      const marker = li.children[0]!;
      expect(marker.kind).toBe('inline-text');
      expect(marker.isAnonymous).toBe(true);
      if (marker.kind === 'inline-text') {
        expect(marker.text).toBe('• ');
      }
    }
  });

  it('prepends decimal marker to ol > li with incrementing counter', () => {
    const root = buildFromHtml('<ol><li>a</li><li>b</li><li>c</li></ol>');
    const ol = childAt(root, 0);
    const expected = ['1. ', '2. ', '3. '];
    ol.children.forEach((li, i) => {
      const marker = li.children[0]!;
      if (marker.kind === 'inline-text') {
        expect(marker.text).toBe(expected[i]);
      } else {
        throw new Error('expected marker inline-text');
      }
    });
  });

  it('does not insert marker for list-style-type: none', () => {
    const root = buildFromHtml('<ul style="list-style-type:none"><li>a</li></ul>');
    const ul = childAt(root, 0);
    const li = ul.children[0]!;
    const first = li.children[0]!;
    if (first.kind === 'inline-text') {
      expect(first.text).toBe('a');
      expect(first.text).not.toBe('• ');
    } else {
      throw new Error(`unexpected first child kind: ${first.kind}`);
    }
  });

  it('marker appears before original content', () => {
    const root = buildFromHtml('<ul><li>content</li></ul>');
    const li = childAt(root, 0, 0);
    const first = li.children[0]!;
    if (first.kind === 'inline-text') {
      expect(first.text).toBe('• ');
    } else {
      throw new Error('expected marker first');
    }
  });

  describe('block-in-inline split', () => {
    it('hoists a block img out of an inline <a>', () => {
      const root = buildFromHtml('<p>pre <a href="/x">before <img src="/i.png" alt="x"> after</a> post</p>');
      const p = childAt(root, 0);
      const hasImg = p.children.some(
        (c) => c.kind === 'image' || (c.kind === 'block' && c.children.some((cc) => cc.kind === 'image')),
      );
      expect(hasImg).toBe(true);
      // No inline box should still contain a block-level image
      function hasBlockInsideInline(box: Box): boolean {
        if (box.kind === 'inline') {
          for (const c of box.children) {
            if (c.kind === 'image' && c.imageDisplay === 'block') return true;
            if (c.kind === 'block') return true;
          }
        }
        for (const c of box.children) if (hasBlockInsideInline(c)) return true;
        return false;
      }
      expect(hasBlockInsideInline(p)).toBe(false);
    });

    it('preserves inline text before and after the hoisted block', () => {
      const root = buildFromHtml('<div><a>before<img src="/i.png">after</a></div>');
      const div = childAt(root, 0);
      // Flatten children and collect text + images in order
      const order: string[] = [];
      function walk(box: Box): void {
        if (box.kind === 'inline-text') order.push('T:' + box.text.trim());
        else if (box.kind === 'image') order.push('IMG');
        for (const c of box.children) walk(c);
      }
      walk(div);
      expect(order).toEqual(['T:before', 'IMG', 'T:after']);
    });
  });
});
