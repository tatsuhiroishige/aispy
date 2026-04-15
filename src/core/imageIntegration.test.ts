import { describe, it, expect, beforeEach, vi } from 'vitest';
import axios from 'axios';
import sharp from 'sharp';
import { JSDOM } from 'jsdom';
import { createStyleResolver } from './cssResolver.js';
import { buildBoxTree } from './buildBoxTree.js';
import { layout, createLayoutContext, createInitialInput } from './layout.js';
import { paint } from './paint.js';
import { serializeGrid } from './ansiSerializer.js';
import { prefetchImages, getDecodedImage, getUploadEscapes, resetImageStore } from './imageStore.js';
import { clearImageCache } from './imageDecoder.js';

vi.mock('axios');
const mockedGet = vi.mocked(axios.get);

async function makePng(w: number, h: number): Promise<Buffer> {
  return sharp({
    create: { width: w, height: h, channels: 4, background: { r: 0, g: 128, b: 0, alpha: 1 } },
  })
    .png()
    .toBuffer();
}

async function renderWithImages(
  html: string,
  width = 80,
  protocol: 'kitty' | 'iterm2' | 'none' = 'kitty',
): Promise<string> {
  const doc = new JSDOM(`<body>${html}</body>`).window.document;
  const root = buildBoxTree(doc, createStyleResolver(doc));
  await prefetchImages(root, {
    imageProtocol: protocol,
    cellPixelWidth: 10,
    cellPixelHeight: 20,
  });
  const ctx = createLayoutContext(1, 1, 10, 20);
  layout(ctx, root, { x: 0, y: 0 }, createInitialInput(width));
  const grid = paint(root, protocol);
  return getUploadEscapes(protocol) + serializeGrid(grid);
}

describe('Image rendering integration', () => {
  beforeEach(() => {
    mockedGet.mockReset();
    clearImageCache();
    resetImageStore();
  });

  it('emits Kitty escape when protocol=kitty and image fetches', async () => {
    const png = await makePng(100, 40);
    mockedGet.mockResolvedValueOnce({ data: png });

    const out = await renderWithImages(
      '<p>before</p><img src="https://ex.com/img.png" alt="test"><p>after</p>',
      60,
      'kitty',
    );
    expect(out).toContain('\x1b_G');
    expect(out).toContain('before');
    expect(out).toContain('after');
  });

  it('emits alt text placeholder when protocol=none', async () => {
    mockedGet.mockResolvedValue({ data: Buffer.alloc(0) });
    const out = await renderWithImages(
      '<p><img src="https://ex.com/img.png" alt="my pic"></p>',
      60,
      'none',
    );
    expect(out).toContain('[image: my pic]');
    expect(out).not.toContain('\x1b_G');
  });

  it('emits alt placeholder when image fetch fails', async () => {
    mockedGet.mockRejectedValueOnce(new Error('404'));
    const out = await renderWithImages(
      '<p><img src="https://ex.com/broken.png" alt="broken"></p>',
      60,
      'kitty',
    );
    expect(out).toContain('[image: broken]');
  });

  it('caches image across repeated URLs in same document', async () => {
    const png = await makePng(50, 25);
    mockedGet.mockResolvedValueOnce({ data: png });

    const doc = new JSDOM(
      '<body><img src="https://ex.com/same.png" alt="a"><img src="https://ex.com/same.png" alt="b"></body>',
    ).window.document;
    const root = buildBoxTree(doc, createStyleResolver(doc));
    await prefetchImages(root, {
      imageProtocol: 'kitty',
      cellPixelWidth: 10,
      cellPixelHeight: 20,
    });
    // axios fetched only once
    expect(mockedGet).toHaveBeenCalledTimes(1);
    // Both boxes got decoded reference
    const imgs: typeof root[] = [];
    function walk(b: typeof root): void {
      if (b.kind === 'image') imgs.push(b);
      for (const c of b.children) walk(c as typeof root);
    }
    walk(root);
    expect(imgs.length).toBe(2);
    for (const b of imgs) {
      if (b.kind === 'image') {
        expect(getDecodedImage(b)).toBeDefined();
      }
    }
  });
});
