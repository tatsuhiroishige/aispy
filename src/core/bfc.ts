import type { Box, BlockBox } from './boxTree.js';
import {
  type BoxLayoutState,
  type LayoutContext,
  type LayoutInput,
  type Offset,
  setLayoutState,
} from './layout.js';
import { layoutInline, type LineBox } from './ifc.js';
import { layoutTable } from './tableLayout.js';
import { getDecodedImage } from './imageStore.js';

function hasInlineChildren(box: BlockBox): boolean {
  for (const c of box.children) {
    if (
      c.kind === 'inline' ||
      c.kind === 'inline-text' ||
      c.kind === 'inline-newline'
    ) return true;
    if (c.kind === 'image' && c.imageDisplay === 'inline') return true;
  }
  return false;
}

export function layoutBlock(
  ctx: LayoutContext,
  box: Box,
  offset: Offset,
  input: LayoutInput,
): BoxLayoutState {
  if (box.kind !== 'block') {
    return layoutAsBlock(ctx, box, offset, input);
  }

  if (box.computed.display === 'table') {
    return layoutTable(ctx, box, offset, input);
  }

  const mt = box.computed.marginTop;
  const mb = box.computed.marginBottom;
  const pl = box.computed.paddingLeft;

  const contentWidth = Math.max(0, input.availableWidth - pl);

  let contentHeight: number;
  let inlineLines: LineBox[] | undefined;

  if (hasInlineChildren(box)) {
    const result = layoutInline(box, contentWidth, ctx.cellPixelWidth);
    contentHeight = result.height;
    inlineLines = result.lines;
  } else {
    let y = 0;
    for (const child of box.children) {
      if (child.kind !== 'block' && child.kind !== 'image') continue;
      const childMt = child.kind === 'block' ? child.computed.marginTop : 0;
      const childMb = child.kind === 'block' ? child.computed.marginBottom : 0;

      const childState = layoutBlock(
        ctx,
        child,
        { x: offset.x + pl, y: offset.y + mt + y + childMt },
        { ...input, availableWidth: contentWidth },
      );
      y += childMt + childState.size.height + childMb;
    }
    contentHeight = y;
  }

  const state: BoxLayoutState = {
    offset: { ...offset },
    size: {
      width: input.availableWidth,
      height: mt + contentHeight + mb,
    },
    intrinsicMin: 0,
    intrinsicMax: input.availableWidth,
    baseline: 0,
    ...(inlineLines ? { lines: inlineLines } : {}),
  };
  setLayoutState(box, state);
  return state;
}

function layoutAsBlock(
  ctx: LayoutContext,
  box: Box,
  offset: Offset,
  input: LayoutInput,
): BoxLayoutState {
  if (box.kind === 'image') {
    return layoutImageBlock(ctx, box, offset, input);
  }
  const state: BoxLayoutState = {
    offset: { ...offset },
    size: { width: input.availableWidth, height: 1 },
    intrinsicMin: 0,
    intrinsicMax: input.availableWidth,
    baseline: 0,
  };
  setLayoutState(box, state);
  return state;
}

function layoutImageBlock(
  ctx: LayoutContext,
  box: Box & { kind: 'image' },
  offset: Offset,
  input: LayoutInput,
): BoxLayoutState {
  const decoded = getDecodedImage(box);
  const maxCellsWide = input.availableWidth;

  let cellW: number;
  let cellH: number;
  if (decoded) {
    cellW = Math.min(maxCellsWide, Math.ceil(decoded.width / ctx.cellPixelWidth));
    cellH = Math.max(1, Math.ceil(decoded.height / ctx.cellPixelHeight));
  } else {
    const text = `[image: ${box.alt || box.src || 'unknown'}]`;
    cellW = Math.min(maxCellsWide, text.length);
    cellH = 1;
  }

  const state: BoxLayoutState = {
    offset: { ...offset },
    size: { width: Math.min(maxCellsWide, cellW), height: cellH },
    intrinsicMin: 0,
    intrinsicMax: input.availableWidth,
    baseline: 0,
  };
  setLayoutState(box, state);
  return state;
}
