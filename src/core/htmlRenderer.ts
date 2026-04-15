import { buildBoxTree } from './buildBoxTree.js';
import { createStyleResolver } from './cssResolver.js';
import { layout, createLayoutContext, createInitialInput } from './layout.js';
import { paint } from './paint.js';
import { serializeGrid } from './ansiSerializer.js';
import { detectTermCapability } from './termCapability.js';
import {
  prefetchImages,
  getUploadEscapes,
  collectFetchableImages,
  decodeBatch,
} from './imageStore.js';

export interface TerminalRender {
  body: string;
  prologue: string;
}

export type RenderPhase = 'text' | 'partial' | 'final';

export interface TerminalRenderUpdate extends TerminalRender {
  phase: RenderPhase;
  decoded: number;
  total: number;
}

const IMAGE_BATCH_SIZE = 4;

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
 * Progressive rendering: build box tree + layout once (using img width/height
 * hints so image cells are pre-sized), then yield the text pass, then decode
 * images in batches of IMAGE_BATCH_SIZE and yield an update per batch. Layout
 * stays stable across yields because hint-based image cells don't depend on
 * decoded pixel dimensions.
 */
export async function* renderHtmlToTerminalStream(
  doc: Document,
  width = 80,
): AsyncGenerator<TerminalRenderUpdate, void, void> {
  const resolver = createStyleResolver(doc);
  const root = buildBoxTree(doc, resolver);
  const capability = detectTermCapability();
  const ctx = createLayoutContext(1, 1, capability.cellPixelWidth, capability.cellPixelHeight);
  layout(ctx, root, { x: 0, y: 0 }, createInitialInput(width));

  const images = collectFetchableImages(root);
  const total = images.length;

  const emit = (phase: RenderPhase, decoded: number): TerminalRenderUpdate => {
    const grid = paint(root, capability.imageProtocol);
    return {
      body: serializeGrid(grid),
      prologue: getUploadEscapes(capability.imageProtocol),
      phase,
      decoded,
      total,
    };
  };

  yield emit('text', 0);

  if (total === 0 || capability.imageProtocol === 'none') {
    yield emit('final', 0);
    return;
  }

  let decoded = 0;
  for (let i = 0; i < images.length; i += IMAGE_BATCH_SIZE) {
    const batch = images.slice(i, i + IMAGE_BATCH_SIZE);
    decoded += await decodeBatch(batch, capability);
    const isLast = i + IMAGE_BATCH_SIZE >= images.length;
    yield emit(isLast ? 'final' : 'partial', decoded);
  }
}
