import type { Box } from './boxTree.js';
import { layoutBlock } from './bfc.js';
import type { LineBox } from './ifc.js';

export interface Size {
  width: number;
  height: number;
}

export interface Offset {
  x: number;
  y: number;
}

export interface LayoutInput {
  availableWidth: number;
  mode: 'normal' | 'measure-min' | 'measure-max';
}

export interface BoxLayoutState {
  offset: Offset;
  size: Size;
  intrinsicMin: number;
  intrinsicMax: number;
  baseline: number;
  lines?: LineBox[];
}

export interface LayoutContext {
  cellWidth: number;
  cellHeight: number;
  cellPixelWidth: number;
  cellPixelHeight: number;
}

const states = new WeakMap<Box, BoxLayoutState>();

export function getLayoutState(box: Box): BoxLayoutState | undefined {
  return states.get(box);
}

export function setLayoutState(box: Box, state: BoxLayoutState): void {
  states.set(box, state);
}

export function createLayoutContext(
  cellWidth = 1,
  cellHeight = 1,
  cellPixelWidth = 10,
  cellPixelHeight = 20,
): LayoutContext {
  return { cellWidth, cellHeight, cellPixelWidth, cellPixelHeight };
}

export function createInitialInput(availableWidth: number): LayoutInput {
  return { availableWidth, mode: 'normal' };
}

export function layout(
  ctx: LayoutContext,
  box: Box,
  offset: Offset,
  input: LayoutInput,
): BoxLayoutState {
  return layoutBlock(ctx, box, offset, input);
}
