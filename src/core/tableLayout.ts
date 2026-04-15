import type { Box, BlockBox } from './boxTree.js';
import {
  type BoxLayoutState,
  type LayoutContext,
  type LayoutInput,
  type Offset,
  setLayoutState,
} from './layout.js';
import { layoutBlock } from './bfc.js';

function collectRows(box: Box, rows: BlockBox[]): void {
  if (box.kind === 'block' && box.computed.display === 'table-row') {
    rows.push(box);
    return;
  }
  for (const c of box.children) collectRows(c, rows);
}

function collectCells(row: BlockBox): BlockBox[] {
  const cells: BlockBox[] = [];
  for (const c of row.children) {
    if (c.kind === 'block' && c.computed.display === 'table-cell') {
      cells.push(c);
    }
  }
  return cells;
}

export function layoutTable(
  ctx: LayoutContext,
  box: BlockBox,
  offset: Offset,
  input: LayoutInput,
): BoxLayoutState {
  const mt = box.computed.marginTop;
  const mb = box.computed.marginBottom;

  const rows: BlockBox[] = [];
  for (const c of box.children) collectRows(c, rows);

  if (rows.length === 0) {
    const state: BoxLayoutState = {
      offset: { ...offset },
      size: { width: input.availableWidth, height: mt + mb },
      intrinsicMin: 0,
      intrinsicMax: input.availableWidth,
      baseline: 0,
    };
    setLayoutState(box, state);
    return state;
  }

  let maxCols = 0;
  for (const row of rows) {
    const count = collectCells(row).length;
    if (count > maxCols) maxCols = count;
  }
  if (maxCols === 0) maxCols = 1;

  const colWidth = Math.max(1, Math.floor(input.availableWidth / maxCols));

  let y = mt;
  for (const row of rows) {
    const cells = collectCells(row);
    let rowHeight = 0;
    let x = 0;
    const cellStates: BoxLayoutState[] = [];
    for (const cell of cells) {
      const cellState = layoutBlock(
        ctx,
        cell,
        { x: offset.x + x, y: offset.y + y },
        { ...input, availableWidth: colWidth },
      );
      cellStates.push(cellState);
      if (cellState.size.height > rowHeight) rowHeight = cellState.size.height;
      x += colWidth;
    }
    if (rowHeight === 0) rowHeight = 1;

    const rowState: BoxLayoutState = {
      offset: { x: offset.x, y: offset.y + y },
      size: { width: input.availableWidth, height: rowHeight },
      intrinsicMin: 0,
      intrinsicMax: input.availableWidth,
      baseline: 0,
    };
    setLayoutState(row, rowState);

    y += rowHeight;
  }

  const state: BoxLayoutState = {
    offset: { ...offset },
    size: { width: input.availableWidth, height: y + mb },
    intrinsicMin: 0,
    intrinsicMax: input.availableWidth,
    baseline: 0,
  };
  setLayoutState(box, state);
  return state;
}
