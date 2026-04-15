import { describe, it, expect } from 'vitest';
import type { Box } from './boxTree.js';
import {
  createGrid,
  setText,
  sourceBoxAt,
  formatAt,
  DEFAULT_FORMAT,
  FF_BOLD,
  FF_UNDERLINE,
} from './flexibleGrid.js';

function makeDummyBox(): Box {
  return {
    kind: 'inline-text',
    computed: {
      display: 'inline',
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
    },
    element: null,
    parent: null,
    children: [],
    isAnonymous: true,
    text: 'dummy',
  };
}

describe('FlexibleGrid', () => {
  it('grows to include the requested row', () => {
    const grid = createGrid();
    setText(grid, 0, 3, 'hello');
    expect(grid.length).toBe(4);
    expect(grid[3]!.str).toBe('hello');
  });

  it('pads with spaces when x > current line width', () => {
    const grid = createGrid();
    setText(grid, 5, 0, 'hi');
    expect(grid[0]!.str).toBe('     hi');
  });

  it('overwrites existing text', () => {
    const grid = createGrid();
    setText(grid, 0, 0, 'hello');
    setText(grid, 2, 0, 'XX');
    expect(grid[0]!.str).toBe('heXXo');
  });

  it('attaches sourceBox to cells', () => {
    const grid = createGrid();
    const box = makeDummyBox();
    setText(grid, 0, 0, 'link', { fg: 12, bg: -1, flags: FF_UNDERLINE }, box);
    expect(sourceBoxAt(grid, 0, 0)).toBe(box);
    expect(sourceBoxAt(grid, 3, 0)).toBe(box);
    expect(sourceBoxAt(grid, 4, 0)).toBe(null);
  });

  it('handles CJK widths in xToStrIndex', () => {
    const grid = createGrid();
    setText(grid, 0, 0, 'あいう');
    expect(grid[0]!.str).toBe('あいう');
    setText(grid, 2, 0, 'X');
    expect(grid[0]!.str).toContain('X');
  });

  it('preserves format across cells', () => {
    const grid = createGrid();
    setText(grid, 0, 0, 'bold', { fg: -1, bg: -1, flags: FF_BOLD });
    const line = grid[0]!;
    const first = formatAt(line, 0);
    expect(first?.format.flags).toBe(FF_BOLD);
  });

  it('default format resets after text', () => {
    const grid = createGrid();
    setText(grid, 0, 0, 'xxx', { fg: -1, bg: -1, flags: FF_BOLD });
    setText(grid, 3, 0, 'yyy');
    const line = grid[0]!;
    const atY = formatAt(line, 3);
    expect(atY?.format.flags).toBe(DEFAULT_FORMAT.flags);
  });

  it('treats combining marks as width 0 (Kitty placeholder codepoint)', () => {
    const grid = createGrid();
    const placeholder = '\u{10EEEE}\u0305\u0305';
    setText(grid, 0, 0, placeholder);
    setText(grid, 1, 0, 'X');
    expect(grid[0]!.str).toBe(placeholder + 'X');
  });

  it('places two placeholder cells side by side', () => {
    const grid = createGrid();
    const cell = (row: number, col: number): string =>
      `\u{10EEEE}${String.fromCodePoint(0x0305 + row)}${String.fromCodePoint(0x0305 + col)}`;
    setText(grid, 0, 0, cell(0, 0));
    setText(grid, 1, 0, cell(0, 1));
    const line = grid[0]!.str;
    expect(line.startsWith(cell(0, 0))).toBe(true);
    expect(line.endsWith(cell(0, 1))).toBe(true);
  });
});
