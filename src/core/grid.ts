import type { Box, BlockBox } from './boxTree.js';
import {
  type BoxLayoutState,
  type LayoutContext,
  type LayoutInput,
  type Offset,
  setLayoutState,
} from './layout.js';

/**
 * MVP CSS grid layout: supports `grid-template-columns` in the forms:
 *   - `repeat(N, 1fr)` → N equal columns
 *   - `1fr 1fr 2fr` → fraction tracks
 *   - `100 200` → fixed cell widths
 *   - `auto auto` → equal fractions (treated as 1fr each)
 * Auto-flow is row-major: fills row by row, children wrap to next row.
 * Does NOT yet support: grid-template-rows, named areas, span, grid-area, auto rows.
 */

type TrackSpec = { kind: 'fr'; value: number } | { kind: 'fixed'; value: number };

function parseTrackList(spec: string): TrackSpec[] {
  const s = spec.trim();

  // repeat(N, pattern)
  const repeatMatch = /^repeat\s*\(\s*(\d+)\s*,\s*(.+?)\s*\)$/i.exec(s);
  if (repeatMatch) {
    const n = parseInt(repeatMatch[1]!, 10);
    const inner = parseTrackList(repeatMatch[2]!);
    const result: TrackSpec[] = [];
    for (let i = 0; i < n; i++) result.push(...inner);
    return result;
  }

  const tokens = s.split(/\s+/);
  return tokens.map((tok) => {
    if (/^\d+(?:\.\d+)?fr$/.test(tok)) {
      return { kind: 'fr' as const, value: parseFloat(tok) };
    }
    if (/^\d+(?:\.\d+)?px$/.test(tok)) {
      return { kind: 'fixed' as const, value: Math.round(parseFloat(tok) / 8) };
    }
    if (/^\d+(?:\.\d+)?$/.test(tok)) {
      return { kind: 'fixed' as const, value: Math.round(parseFloat(tok)) };
    }
    // 'auto' or unknown → treat as 1fr
    return { kind: 'fr' as const, value: 1 };
  });
}

function distributeTracks(specs: TrackSpec[], totalWidth: number, gap: number): number[] {
  const gapTotal = gap * Math.max(0, specs.length - 1);
  let remaining = Math.max(0, totalWidth - gapTotal);

  const widths = new Array<number>(specs.length).fill(0);
  let frSum = 0;
  specs.forEach((spec, i) => {
    if (spec.kind === 'fixed') {
      widths[i] = Math.min(spec.value, remaining);
      remaining -= widths[i]!;
    } else {
      frSum += spec.value;
    }
  });
  if (frSum > 0 && remaining > 0) {
    const unit = remaining / frSum;
    specs.forEach((spec, i) => {
      if (spec.kind === 'fr') widths[i] = Math.max(1, Math.floor(unit * spec.value));
    });
  }
  return widths;
}

function isWhitespaceOnly(box: Box): boolean {
  if (box.kind === 'inline-text') return /^\s*$/.test(box.text);
  if (box.kind === 'image') return false;
  if (!box.isAnonymous && box.element) return false;
  for (const c of box.children) {
    if (!isWhitespaceOnly(c)) return false;
  }
  return true;
}

export function isGridContainer(box: Box): boolean {
  return (
    box.kind === 'block' &&
    box.computed.display === 'grid' &&
    typeof box.computed.gridTemplateColumns === 'string' &&
    box.computed.gridTemplateColumns.trim().length > 0
  );
}

export function layoutGrid(
  ctx: LayoutContext,
  box: BlockBox,
  offset: Offset,
  input: LayoutInput,
  layoutChild: (
    ctx: LayoutContext,
    child: Box,
    offset: Offset,
    input: LayoutInput,
  ) => BoxLayoutState,
): BoxLayoutState {
  const mt = box.computed.marginTop;
  const mb = box.computed.marginBottom;
  const pl = box.computed.paddingLeft;
  const gap = box.computed.gridGap ?? 0;

  const contentWidth = Math.max(0, input.availableWidth - pl);
  const spec = box.computed.gridTemplateColumns ?? '1fr';
  const tracks = parseTrackList(spec);
  const trackWidths = distributeTracks(tracks, contentWidth, gap);
  const numCols = Math.max(1, trackWidths.length);

  const children = box.children.filter(
    (c) => (c.kind === 'block' || c.kind === 'image') && !isWhitespaceOnly(c),
  );

  let y = 0;
  for (let row = 0; row < Math.ceil(children.length / numCols); row++) {
    let rowHeight = 0;
    let x = 0;
    for (let col = 0; col < numCols; col++) {
      const idx = row * numCols + col;
      const child = children[idx];
      if (!child) break;
      const cellWidth = trackWidths[col] ?? 0;
      const childState = layoutChild(
        ctx,
        child,
        { x: offset.x + pl + x, y: offset.y + mt + y },
        { ...input, availableWidth: cellWidth },
      );
      if (childState.size.height > rowHeight) rowHeight = childState.size.height;
      x += cellWidth + gap;
    }
    y += rowHeight + (row > 0 ? 0 : 0) + gap;
  }
  // Remove trailing gap
  if (y > 0) y = Math.max(0, y - gap);

  const state: BoxLayoutState = {
    offset: { ...offset },
    size: { width: input.availableWidth, height: mt + y + mb },
    intrinsicMin: 0,
    intrinsicMax: input.availableWidth,
    baseline: 0,
  };
  setLayoutState(box, state);
  return state;
}

export const _internal = { parseTrackList, distributeTracks };
