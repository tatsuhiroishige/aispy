import type { Box, ImageBox } from './boxTree.js';
import { decodeImage, type DecodedImage } from './imageDecoder.js';
import type { ImageProtocol, TermCapability } from './termCapability.js';
import { setImageStoreRef } from './ifc.js';
import { encodeKittyVirtualUpload } from './imageProtocol.js';

const boxStore = new WeakMap<ImageBox, DecodedImage>();
const urlStore = new Map<string, DecodedImage>();
const idByImage = new WeakMap<DecodedImage, number>();
const registered = new Map<number, DecodedImage>();

let idCounter = 0;

function lookupDecoded(box: ImageBox): DecodedImage | undefined {
  const viaBox = boxStore.get(box);
  if (viaBox) return viaBox;
  if (box.src) return urlStore.get(box.src);
  return undefined;
}

setImageStoreRef(lookupDecoded);

const MAX_IMAGE_CELLS_WIDTH = 40;
const MAX_IMAGE_CELLS_HEIGHT = 20;

export function getDecodedImage(box: ImageBox): DecodedImage | undefined {
  return lookupDecoded(box);
}

export function ensureImageId(img: DecodedImage): number {
  const existing = idByImage.get(img);
  if (existing !== undefined) return existing;
  idCounter = (idCounter + 1) & 0xffffff;
  if (idCounter === 0) idCounter = 1;
  idByImage.set(img, idCounter);
  registered.set(idCounter, img);
  return idCounter;
}

export function getUploadEscapes(protocol: ImageProtocol): string {
  if (protocol !== 'kitty' || registered.size === 0) return '';
  const parts: string[] = [];
  for (const [id, img] of registered) {
    parts.push(encodeKittyVirtualUpload(img, id));
  }
  return parts.join('');
}

export function resetImageStore(): void {
  urlStore.clear();
  registered.clear();
  idCounter = 0;
}

function collectImages(box: Box, images: ImageBox[]): void {
  if (box.kind === 'image' && box.src) {
    images.push(box);
  }
  for (const c of box.children) collectImages(c, images);
}

export async function prefetchImages(
  root: Box,
  capability: TermCapability,
): Promise<void> {
  if (capability.imageProtocol === 'none') return;

  const images: ImageBox[] = [];
  collectImages(root, images);
  if (images.length === 0) return;

  const maxPxW = MAX_IMAGE_CELLS_WIDTH * capability.cellPixelWidth;
  const maxPxH = MAX_IMAGE_CELLS_HEIGHT * capability.cellPixelHeight;

  const CONCURRENCY = 4;
  const queue = [...images];

  async function worker(): Promise<void> {
    while (queue.length > 0) {
      const box = queue.shift();
      if (!box) break;
      try {
        const src = resolveUrl(box);
        if (!src) continue;
        const decoded = await decodeImage(src, maxPxW, maxPxH);
        if (decoded) {
          boxStore.set(box, decoded);
          urlStore.set(src, decoded);
          if (box.src && box.src !== src) urlStore.set(box.src, decoded);
          ensureImageId(decoded);
        }
      } catch {
        // swallow; undecoded images fall back to alt text
      }
    }
  }

  const workers: Promise<void>[] = [];
  for (let i = 0; i < CONCURRENCY; i++) workers.push(worker());
  await Promise.all(workers);
}

function resolveUrl(box: ImageBox): string | null {
  if (!box.src) return null;
  if (/^https?:\/\//.test(box.src)) return box.src;
  if (box.src.startsWith('//')) return `https:${box.src}`;
  if (box.src.startsWith('data:')) return null;
  return null;
}
