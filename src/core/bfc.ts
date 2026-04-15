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
import { ExclusionList, isFloated, clearValue } from './floats.js';
import { isGridContainer, layoutGrid } from './grid.js';

function estimateFloatWidth(box: Box, containerWidth: number): number {
  if (box.kind === 'block' && typeof box.computed.width === 'number' && box.computed.width > 0) {
    return Math.min(containerWidth, box.computed.width);
  }
  // Shrink-to-fit heuristic: ~35% of container, clamped.
  const fallback = Math.min(containerWidth, Math.max(12, Math.floor(containerWidth * 0.35)));
  return Math.max(1, fallback);
}

function collectFloatsAndFlow(box: BlockBox): {
  floats: Box[];
  flow: Box[];
} {
  const floats: Box[] = [];
  const flow: Box[] = [];
  for (const c of box.children) {
    if (isFloated(c)) floats.push(c);
    else flow.push(c);
  }
  return { floats, flow };
}

function placeFloats(
  ctx: LayoutContext,
  floats: Box[],
  exclusions: ExclusionList,
  parentOffset: Offset,
  contentOffsetX: number,
  contentTopY: number,
  contentWidth: number,
  input: LayoutInput,
): void {
  for (const float of floats) {
    const side = float.computed.float === 'right' ? 'right' : 'left';
    const floatWidth = estimateFloatWidth(float, contentWidth);
    const fitY = exclusions.findFitY(0, floatWidth, contentWidth);

    let innerX: number;
    if (side === 'left') {
      const { x: leftUsed } = exclusions.availableAt(fitY, contentWidth);
      innerX = leftUsed;
    } else {
      innerX = Math.max(0, contentWidth - floatWidth - rightUsedAt(exclusions, fitY));
    }

    const floatState = layoutBlock(
      ctx,
      float,
      {
        x: parentOffset.x + contentOffsetX + innerX,
        y: parentOffset.y + contentTopY + fitY,
      },
      { ...input, availableWidth: floatWidth },
    );
    exclusions.add({
      side,
      top: fitY,
      bottom: fitY + floatState.size.height,
      width: floatWidth,
    });
  }
}

function rightUsedAt(exclusions: ExclusionList, y: number): number {
  let used = 0;
  for (const ex of exclusions.all()) {
    if (ex.side !== 'right') continue;
    if (y < ex.top || y >= ex.bottom) continue;
    if (ex.width > used) used = ex.width;
  }
  return used;
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

  if (isGridContainer(box)) {
    return layoutGrid(ctx, box, offset, input, layoutBlock);
  }

  const mt = box.computed.marginTop;
  const mb = box.computed.marginBottom;
  const pl = box.computed.paddingLeft;
  // Border consumes 1 cell of the content area on each side when present.
  const hasBorder = box.computed.borderStyle && box.computed.borderStyle !== 'none';
  const bs = hasBorder ? 1 : 0;

  const contentWidth = Math.max(0, input.availableWidth - pl - 2 * bs);
  const contentTopY = mt + bs;

  const exclusions = new ExclusionList();
  const { floats, flow } = collectFloatsAndFlow(box);

  // Pass 1: place floats out-of-flow
  placeFloats(
    ctx,
    floats,
    exclusions,
    offset,
    pl + bs,
    contentTopY,
    contentWidth,
    input,
  );

  let contentHeight: number;
  let inlineLines: LineBox[] | undefined;

  if (flow.some(childIsInlineLike)) {
    const result = layoutInline(box, contentWidth, ctx.cellPixelWidth, exclusions);
    contentHeight = result.height;
    inlineLines = result.lines;
  } else {
    let y = 0;
    for (const child of flow) {
      if (child.kind !== 'block' && child.kind !== 'image') continue;
      const childMt = child.kind === 'block' ? child.computed.marginTop : 0;
      const childMb = child.kind === 'block' ? child.computed.marginBottom : 0;
      const childClear = child.kind === 'block' ? clearValue(child) : 'none';

      if (childClear !== 'none') {
        y = exclusions.clearY(y, childClear);
      }

      const { x: floatX, width: availWidth } = exclusions.availableAt(
        y + childMt,
        contentWidth,
      );

      const childState = layoutBlock(
        ctx,
        child,
        {
          x: offset.x + pl + bs + floatX,
          y: offset.y + contentTopY + y + childMt,
        },
        { ...input, availableWidth: availWidth },
      );
      y += childMt + childState.size.height + childMb;
    }
    contentHeight = y;
  }

  // Parent must contain floats — extend height to max(flow bottom, last float bottom)
  contentHeight = Math.max(contentHeight, exclusions.maxBottom());

  const state: BoxLayoutState = {
    offset: { ...offset },
    size: {
      width: input.availableWidth,
      height: mt + bs + contentHeight + bs + mb,
    },
    intrinsicMin: 0,
    intrinsicMax: input.availableWidth,
    baseline: 0,
    ...(inlineLines ? { lines: inlineLines } : {}),
  };
  setLayoutState(box, state);
  return state;
}

function childIsInlineLike(box: Box): boolean {
  if (isFloated(box)) return false;
  if (
    box.kind === 'inline' ||
    box.kind === 'inline-text' ||
    box.kind === 'inline-newline'
  ) return true;
  if (box.kind === 'image' && box.imageDisplay === 'inline') return true;
  return false;
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

const DEFAULT_PLACEHOLDER_CELL_W = 20;
const DEFAULT_PLACEHOLDER_CELL_H = 10;
const MAX_IMAGE_CELLS_WIDTH = 40;
const MAX_IMAGE_CELLS_HEIGHT = 20;

function estimateImageCellSize(
  box: Box & { kind: 'image' },
  ctx: LayoutContext,
  maxCellsWide: number,
): { cellW: number; cellH: number } {
  const decoded = getDecodedImage(box);
  if (decoded) {
    const cellW = Math.min(maxCellsWide, Math.ceil(decoded.width / ctx.cellPixelWidth));
    const cellH = Math.max(1, Math.ceil(decoded.height / ctx.cellPixelHeight));
    return { cellW, cellH };
  }
  const clampW = Math.min(maxCellsWide, MAX_IMAGE_CELLS_WIDTH);
  const clampH = MAX_IMAGE_CELLS_HEIGHT;
  const hintW = box.hintWidth;
  const hintH = box.hintHeight;
  if (hintW && hintH) {
    const cellW = Math.min(clampW, Math.max(1, Math.ceil(hintW / ctx.cellPixelWidth)));
    // Preserve aspect ratio if the hint width got clamped by maxCellsWide.
    const pxW = cellW * ctx.cellPixelWidth;
    const pxH = (pxW / hintW) * hintH;
    const cellH = Math.min(clampH, Math.max(1, Math.ceil(pxH / ctx.cellPixelHeight)));
    return { cellW, cellH };
  }
  if (hintW) {
    const cellW = Math.min(clampW, Math.max(1, Math.ceil(hintW / ctx.cellPixelWidth)));
    return { cellW, cellH: DEFAULT_PLACEHOLDER_CELL_H };
  }
  if (hintH) {
    const cellH = Math.min(clampH, Math.max(1, Math.ceil(hintH / ctx.cellPixelHeight)));
    return { cellW: Math.min(clampW, DEFAULT_PLACEHOLDER_CELL_W), cellH };
  }
  return {
    cellW: Math.min(clampW, DEFAULT_PLACEHOLDER_CELL_W),
    cellH: DEFAULT_PLACEHOLDER_CELL_H,
  };
}

function layoutImageBlock(
  ctx: LayoutContext,
  box: Box & { kind: 'image' },
  offset: Offset,
  input: LayoutInput,
): BoxLayoutState {
  const maxCellsWide = input.availableWidth;
  const { cellW, cellH } = estimateImageCellSize(box, ctx, maxCellsWide);

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
