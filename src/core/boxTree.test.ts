import { describe, it, expect } from 'vitest';
import type { ComputedStyle } from './cssResolver.js';
import type { Box, BlockBox, InlineTextBox } from './boxTree.js';
import { isBlock, isInline, isInlineText, isInlineLike, isImage } from './boxTree.js';

const DEFAULT_STYLE: ComputedStyle = {
  display: 'block',
  fontWeight: 'normal',
  color: '',
  textDecoration: 'none',
  marginTop: 0,
  marginBottom: 0,
  paddingLeft: 0,
  textAlign: 'left',
  listStyleType: '',
  whiteSpace: 'normal',
  visibility: 'visible',
};

function makeBlock(children: Box[] = []): BlockBox {
  return {
    kind: 'block',
    computed: DEFAULT_STYLE,
    element: null,
    parent: null,
    children,
    isAnonymous: false,
  };
}

function makeText(text: string): InlineTextBox {
  return {
    kind: 'inline-text',
    computed: { ...DEFAULT_STYLE, display: 'inline' },
    element: null,
    parent: null,
    children: [],
    isAnonymous: false,
    text,
  };
}

describe('boxTree types', () => {
  it('discriminates block boxes', () => {
    const box = makeBlock();
    expect(isBlock(box)).toBe(true);
    expect(isInline(box)).toBe(false);
    expect(isInlineLike(box)).toBe(false);
    expect(isImage(box)).toBe(false);
  });

  it('discriminates inline-text boxes', () => {
    const box = makeText('hello');
    expect(isInlineText(box)).toBe(true);
    expect(isInlineLike(box)).toBe(true);
    expect(isBlock(box)).toBe(false);
  });

  it('supports nesting in children', () => {
    const text = makeText('hi');
    const block = makeBlock([text]);
    expect(block.children).toHaveLength(1);
    expect(block.children[0]).toBe(text);
  });

  it('exhaustive switch on kind', () => {
    function describeBox(box: Box): string {
      switch (box.kind) {
        case 'block':
          return 'block';
        case 'inline':
          return 'inline';
        case 'inline-text':
          return `text:${box.text}`;
        case 'inline-newline':
          return 'newline';
        case 'image':
          return `img:${box.src}`;
      }
    }
    expect(describeBox(makeBlock())).toBe('block');
    expect(describeBox(makeText('x'))).toBe('text:x');
  });
});
