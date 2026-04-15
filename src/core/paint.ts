import type { Box } from './boxTree.js';
import {
  type FlexibleGrid,
  type Format,
  FF_BOLD,
  FF_ITALIC,
  FF_UNDERLINE,
  FF_STRIKE,
  createGrid,
  setText,
} from './flexibleGrid.js';
import { getLayoutState } from './layout.js';
import { getDecodedImage, ensureImageId } from './imageStore.js';
import { encodeKittyPlaceholder } from './imageProtocol.js';
import type { ImageProtocol } from './termCapability.js';

const NAMED_COLORS_256: Record<string, number> = {
  black: 0,
  red: 1,
  green: 2,
  yellow: 3,
  blue: 4,
  magenta: 5,
  cyan: 6,
  white: 7,
  gray: 8,
  grey: 8,
};

function parseColor(value: string): number {
  if (!value) return -1;
  const v = value.trim().toLowerCase();
  if (v in NAMED_COLORS_256) return NAMED_COLORS_256[v]!;
  const hex3 = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/;
  const hex6 = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/;
  let m = hex3.exec(v);
  let r: number, g: number, b: number;
  if (m) {
    r = parseInt(m[1]! + m[1]!, 16);
    g = parseInt(m[2]! + m[2]!, 16);
    b = parseInt(m[3]! + m[3]!, 16);
  } else {
    m = hex6.exec(v);
    if (!m) return -1;
    r = parseInt(m[1]!, 16);
    g = parseInt(m[2]!, 16);
    b = parseInt(m[3]!, 16);
  }
  const r5 = Math.round((r / 255) * 5);
  const g5 = Math.round((g / 255) * 5);
  const b5 = Math.round((b / 255) * 5);
  return 16 + 36 * r5 + 6 * g5 + b5;
}

function computeFormatForBox(box: Box | null): Format {
  let flags = 0;
  let fg = -1;
  let cursor: Box | null = box;
  while (cursor) {
    if (cursor.computed.fontWeight === 'bold') flags |= FF_BOLD;
    const td = cursor.computed.textDecoration;
    if (td.includes('underline')) flags |= FF_UNDERLINE;
    if (td.includes('line-through')) flags |= FF_STRIKE;
    if (fg === -1) {
      const c = parseColor(cursor.computed.color);
      if (c !== -1) fg = c;
    }
    const tag = cursor.element?.tagName;
    if (tag === 'EM' || tag === 'I') flags |= FF_ITALIC;
    cursor = cursor.parent;
  }
  return { fg, bg: -1, flags };
}

function paintBox(box: Box, grid: FlexibleGrid, protocol: ImageProtocol): void {
  const state = getLayoutState(box);
  if (!state) {
    for (const child of box.children) paintBox(child, grid, protocol);
    return;
  }

  if (box.kind === 'image') {
    paintImage(box, grid, protocol);
    return;
  }

  const mt = box.kind === 'block' ? box.computed.marginTop : 0;
  const pl = box.kind === 'block' ? box.computed.paddingLeft : 0;

  const contentX = state.offset.x + pl;
  const contentY = state.offset.y + mt;

  if (state.lines) {
    for (const line of state.lines) {
      const lineY = contentY + line.offsetY;
      for (const atom of line.atoms) {
        if (atom.text === ' ' && atom.width === 1 && line.atoms.length === 1) continue;
        if (
          atom.sourceBox &&
          atom.sourceBox.kind === 'image' &&
          protocol === 'kitty'
        ) {
          paintInlineImageAtom(
            atom.sourceBox,
            contentX + atom.x,
            lineY,
            atom.width,
            grid,
          );
          continue;
        }
        const format = computeFormatForBox(atom.sourceBox);
        setText(grid, contentX + atom.x, lineY, atom.text, format, atom.sourceBox);
      }
    }
    paintHeadingUnderline(box, grid, state, contentX, contentY);
    return;
  }

  for (const child of box.children) {
    paintBox(child, grid, protocol);
  }
}

function paintInlineImageAtom(
  box: Box & { kind: 'image' },
  x: number,
  y: number,
  width: number,
  grid: FlexibleGrid,
): void {
  const decoded = getDecodedImage(box);
  if (!decoded || width <= 0) {
    const placeholder = `[image: ${box.alt || box.src || 'unknown'}]`;
    setText(grid, x, y, placeholder, { fg: -1, bg: -1, flags: FF_ITALIC }, box);
    return;
  }
  const id = ensureImageId(decoded);
  for (let col = 0; col < width; col++) {
    const cell = encodeKittyPlaceholder(0, col);
    setText(grid, x + col, y, cell, { fg: -1, bg: -1, flags: 0, fgTrueColor: id }, box);
  }
}

function paintImage(
  box: Box & { kind: 'image' },
  grid: FlexibleGrid,
  protocol: ImageProtocol,
): void {
  const state = getLayoutState(box);
  if (!state) return;

  const decoded = getDecodedImage(box);
  if (!decoded || protocol !== 'kitty') {
    const placeholder = `[image: ${box.alt || box.src || 'unknown'}]`;
    setText(
      grid,
      state.offset.x,
      state.offset.y,
      placeholder,
      { fg: -1, bg: -1, flags: FF_ITALIC },
      box,
    );
    return;
  }

  const id = ensureImageId(decoded);
  const w = state.size.width;
  const h = state.size.height;
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      const cell = encodeKittyPlaceholder(dy, dx);
      setText(
        grid,
        state.offset.x + dx,
        state.offset.y + dy,
        cell,
        { fg: -1, bg: -1, flags: 0, fgTrueColor: id },
        box,
      );
    }
  }
}

function paintHeadingUnderline(
  box: Box,
  grid: FlexibleGrid,
  state: { lines?: { offsetY: number; width: number }[] },
  contentX: number,
  contentY: number,
): void {
  if (box.kind !== 'block' || !box.element || !state.lines || state.lines.length === 0) return;
  const tag = box.element.tagName;
  const char = tag === 'H1' ? '═' : tag === 'H2' ? '─' : null;
  if (char === null) return;

  let maxWidth = 0;
  let lastOffsetY = 0;
  for (const line of state.lines) {
    if (line.width > maxWidth) maxWidth = line.width;
    if (line.offsetY > lastOffsetY) lastOffsetY = line.offsetY;
  }
  if (maxWidth === 0) return;
  const y = contentY + lastOffsetY + 1;
  const fg = computeFormatForBox(box).fg;
  setText(grid, contentX, y, char.repeat(maxWidth), { fg, bg: -1, flags: FF_BOLD }, null);
}

function collectLinks(box: Box, urls: string[], seen: Set<string>): void {
  if (box.kind === 'inline' && box.element && box.element.tagName === 'A') {
    const href = box.element.getAttribute('href');
    if (
      href &&
      !seen.has(href) &&
      !href.startsWith('#') &&
      !href.startsWith('javascript:') &&
      !href.startsWith('mailto:')
    ) {
      seen.add(href);
      urls.push(href);
    }
  }
  for (const child of box.children) collectLinks(child, urls, seen);
}

function appendSources(grid: FlexibleGrid, root: Box): void {
  const urls: string[] = [];
  collectLinks(root, urls, new Set());
  if (urls.length === 0) return;

  const startY = grid.length + 1;
  setText(
    grid,
    0,
    startY,
    '── Sources ──',
    { fg: -1, bg: -1, flags: FF_BOLD },
    null,
  );
  urls.forEach((url, i) => {
    setText(
      grid,
      0,
      startY + 2 + i,
      `[${i + 1}] ${url}`,
      { fg: -1, bg: -1, flags: 0 },
      null,
    );
  });
}

export function paint(root: Box, protocol: ImageProtocol = 'none'): FlexibleGrid {
  const grid = createGrid();
  paintBox(root, grid, protocol);
  appendSources(grid, root);
  return grid;
}
