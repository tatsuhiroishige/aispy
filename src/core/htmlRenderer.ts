import { buildBoxTree } from './buildBoxTree.js';
import { createStyleResolver } from './cssResolver.js';
import { layout, createLayoutContext, createInitialInput } from './layout.js';
import { paint } from './paint.js';
import { serializeGrid } from './ansiSerializer.js';
import { detectTermCapability } from './termCapability.js';
import { prefetchImages, getUploadEscapes } from './imageStore.js';

export interface TerminalRender {
  body: string;
  prologue: string;
}

export type RenderPhase = 'text' | 'final';

export interface TerminalRenderUpdate extends TerminalRender {
  phase: RenderPhase;
}

function paintAndSerialize(
  doc: Document,
  width: number,
): { body: string; prologue: string } {
  const resolver = createStyleResolver(doc);
  const root = buildBoxTree(doc, resolver);
  const capability = detectTermCapability();
  const ctx = createLayoutContext(1, 1, capability.cellPixelWidth, capability.cellPixelHeight);
  layout(ctx, root, { x: 0, y: 0 }, createInitialInput(width));
  const grid = paint(root, capability.imageProtocol);
  const prologue = getUploadEscapes(capability.imageProtocol);
  return { body: serializeGrid(grid), prologue };
}

export async function renderHtmlToTerminalParts(
  doc: Document,
  width = 80,
): Promise<TerminalRender> {
  const resolver = createStyleResolver(doc);
  const root = buildBoxTree(doc, resolver);
  const capability = detectTermCapability();
  await prefetchImages(root, capability);
  const ctx = createLayoutContext(1, 1, capability.cellPixelWidth, capability.cellPixelHeight);
  layout(ctx, root, { x: 0, y: 0 }, createInitialInput(width));
  const grid = paint(root, capability.imageProtocol);
  const prologue = getUploadEscapes(capability.imageProtocol);
  return { body: serializeGrid(grid), prologue };
}

export async function renderHtmlToTerminal(doc: Document, width = 80): Promise<string> {
  const { body, prologue } = await renderHtmlToTerminalParts(doc, width);
  return prologue + body;
}

/**
 * Streams two render passes:
 *   1) text-only: layout + paint with no image data (images become alt-text fallback)
 *   2) final: after image prefetch, re-layout + re-paint with placeholder cells
 * Caller can yield the first pass to UI immediately for fast perceived load.
 */
export async function* renderHtmlToTerminalStream(
  doc: Document,
  width = 80,
): AsyncGenerator<TerminalRenderUpdate, void, void> {
  // Build a fresh box tree for the text-only pass
  const textPass = paintAndSerialize(doc, width);
  yield { ...textPass, phase: 'text' };

  // Prefetch images (mutates the imageStore) then re-render with image data
  const resolver = createStyleResolver(doc);
  const root = buildBoxTree(doc, resolver);
  const capability = detectTermCapability();
  await prefetchImages(root, capability);
  const ctx = createLayoutContext(1, 1, capability.cellPixelWidth, capability.cellPixelHeight);
  layout(ctx, root, { x: 0, y: 0 }, createInitialInput(width));
  const grid = paint(root, capability.imageProtocol);
  const prologue = getUploadEscapes(capability.imageProtocol);
  yield { body: serializeGrid(grid), prologue, phase: 'final' };
}
