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

function layoutHtml(html: string, width = 80) {
  const doc = new JSDOM(html).window.document;
  const root = buildBoxTree(doc, createStyleResolver(doc));
  layout(createLayoutContext(), root, { x: 0, y: 0 }, createInitialInput(width));
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

describe('Inline formatting context', () => {
  it('wraps long text across multiple lines', () => {
    const root = layoutHtml('<p>word1 word2 word3 word4 word5 word6</p>', 15);
    const p = childAt(root, 0);
    const lines = getLayoutState(p)?.lines;
    expect(lines).toBeDefined();
    expect(lines!.length).toBeGreaterThan(1);
  });

  it('fits short text on a single line', () => {
    const root = layoutHtml('<p>hi</p>', 80);
    const p = childAt(root, 0);
    const lines = getLayoutState(p)?.lines;
    expect(lines).toHaveLength(1);
    expect(lines![0]!.atoms[0]!.text).toBe('hi');
  });

  it('respects <br> as forced line break', () => {
    const root = layoutHtml('<p>line1<br>line2</p>', 80);
    const p = childAt(root, 0);
    const lines = getLayoutState(p)?.lines;
    expect(lines!.length).toBe(2);
  });

  it('CJK characters can wrap per-char', () => {
    const root = layoutHtml('<p>あいうえおかきくけこ</p>', 10);
    const p = childAt(root, 0);
    const lines = getLayoutState(p)?.lines;
    expect(lines!.length).toBeGreaterThan(1);
  });

  it('CJK chars have width 2', () => {
    const root = layoutHtml('<p>あ</p>', 80);
    const p = childAt(root, 0);
    const atoms = getLayoutState(p)!.lines![0]!.atoms;
    expect(atoms[0]!.width).toBe(2);
  });

  it('strips trailing whitespace at wrap point', () => {
    const root = layoutHtml('<p>hello world</p>', 7);
    const p = childAt(root, 0);
    const lines = getLayoutState(p)!.lines!;
    expect(lines.length).toBe(2);
    const first = lines[0]!;
    const last = first.atoms[first.atoms.length - 1];
    expect(last?.text).not.toBe(' ');
  });

  it('atom.x accumulates on a line', () => {
    const root = layoutHtml('<p>a b c</p>', 80);
    const p = childAt(root, 0);
    const atoms = getLayoutState(p)!.lines![0]!.atoms;
    for (let i = 1; i < atoms.length; i++) {
      expect(atoms[i]!.x).toBeGreaterThanOrEqual(atoms[i - 1]!.x);
    }
  });

  it('sourceBox points to inline-text node', () => {
    const root = layoutHtml('<p>hello</p>', 80);
    const p = childAt(root, 0);
    const atom = getLayoutState(p)!.lines![0]!.atoms[0]!;
    expect(atom.sourceBox.kind).toBe('inline-text');
  });

  it('empty paragraph produces no lines', () => {
    const root = layoutHtml('<p></p>', 80);
    const p = childAt(root, 0);
    const lines = getLayoutState(p)?.lines ?? [];
    expect(lines.length).toBe(0);
  });
});
