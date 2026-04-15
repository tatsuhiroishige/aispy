import type { DecodedImage } from './imageDecoder.js';
import type { ImageProtocol } from './termCapability.js';

const ESC = '\x1b';
const ST = `${ESC}\\`;
const CHUNK_SIZE = 4096;

export const PLACEHOLDER_CODEPOINT = 0x10eeee;

const ROWCOL_DIACRITICS: readonly number[] = [
  0x0305, 0x030d, 0x030e, 0x0310, 0x0312, 0x033d, 0x033e, 0x033f,
  0x0346, 0x034a, 0x034b, 0x034c, 0x0350, 0x0351, 0x0352, 0x0357,
  0x035b, 0x0363, 0x0364, 0x0365, 0x0366, 0x0367, 0x0368, 0x0369,
  0x036a, 0x036b, 0x036c, 0x036d, 0x036e, 0x036f, 0x0483, 0x0484,
  0x0485, 0x0486, 0x0487, 0x0592, 0x0593, 0x0594, 0x0595, 0x0597,
  0x0598, 0x0599, 0x059c, 0x059d, 0x059e, 0x059f, 0x05a0, 0x05a1,
  0x05a8, 0x05a9, 0x05ab, 0x05ac, 0x05af, 0x05c4, 0x0610, 0x0611,
  0x0612, 0x0613, 0x0614, 0x0615, 0x0616, 0x0617, 0x0657, 0x0658,
];

export function diacriticForIndex(index: number): number {
  if (index < 0 || index >= ROWCOL_DIACRITICS.length) {
    throw new Error(`Kitty placeholder index ${index} out of range (max ${ROWCOL_DIACRITICS.length - 1})`);
  }
  return ROWCOL_DIACRITICS[index]!;
}

export function diacriticCapacity(): number {
  return ROWCOL_DIACRITICS.length;
}

export interface KittyOptions {
  imageId?: number;
  placementId?: number;
}

function chunkBase64(img: DecodedImage): string[] {
  const b64 = img.data.toString('base64');
  const chunks: string[] = [];
  for (let i = 0; i < b64.length; i += CHUNK_SIZE) {
    chunks.push(b64.slice(i, i + CHUNK_SIZE));
  }
  return chunks;
}

export function encodeKitty(img: DecodedImage, opts: KittyOptions = {}): string {
  const chunks = chunkBase64(img);
  if (chunks.length === 0) return '';

  const id = opts.imageId ?? nextImageId();
  const result: string[] = [];
  chunks.forEach((chunk, index) => {
    const isFirst = index === 0;
    const isLast = index === chunks.length - 1;
    const parts: string[] = [];
    if (isFirst) {
      parts.push('a=T');
      parts.push('f=32');
      parts.push(`s=${img.width}`);
      parts.push(`v=${img.height}`);
      parts.push(`i=${id}`);
      parts.push('C=1'); // do not move cursor after display
      parts.push('q=2'); // suppress terminal responses
      if (opts.placementId !== undefined) parts.push(`p=${opts.placementId}`);
    } else {
      parts.push(`i=${id}`);
    }
    parts.push(`m=${isLast ? 0 : 1}`);
    result.push(`${ESC}_G${parts.join(',')};${chunk}${ST}`);
  });
  return result.join('');
}

export function encodeKittyVirtualUpload(img: DecodedImage, id: number): string {
  const chunks = chunkBase64(img);
  if (chunks.length === 0) return '';

  const result: string[] = [];
  chunks.forEach((chunk, index) => {
    const isFirst = index === 0;
    const isLast = index === chunks.length - 1;
    const parts: string[] = [];
    if (isFirst) {
      parts.push('a=T');
      parts.push('f=32');
      parts.push(`s=${img.width}`);
      parts.push(`v=${img.height}`);
      parts.push(`i=${id}`);
      parts.push('U=1'); // Unicode placeholder mode: upload only
      parts.push('q=2'); // suppress terminal responses
    } else {
      parts.push(`i=${id}`);
    }
    parts.push(`m=${isLast ? 0 : 1}`);
    result.push(`${ESC}_G${parts.join(',')};${chunk}${ST}`);
  });
  return result.join('');
}

export function encodeKittyPlaceholder(row: number, col: number): string {
  return (
    String.fromCodePoint(PLACEHOLDER_CODEPOINT) +
    String.fromCodePoint(diacriticForIndex(row)) +
    String.fromCodePoint(diacriticForIndex(col))
  );
}

export function encodeITerm2(img: DecodedImage, rawBytes: Buffer): string {
  const b64 = rawBytes.toString('base64');
  const size = rawBytes.length;
  return `${ESC}]1337;File=inline=1;size=${size};width=${img.width}px;height=${img.height}px:${b64}\x07`;
}

export function encodeImageEscape(
  protocol: ImageProtocol,
  img: DecodedImage,
  rawBytes?: Buffer,
): string {
  switch (protocol) {
    case 'kitty':
      return encodeKitty(img);
    case 'iterm2':
      return rawBytes ? encodeITerm2(img, rawBytes) : '';
    case 'sixel':
    case 'none':
      return '';
  }
}

let imageIdCounter = 0;
function nextImageId(): number {
  imageIdCounter = (imageIdCounter + 1) & 0x7fffffff;
  if (imageIdCounter === 0) imageIdCounter = 1;
  return imageIdCounter;
}

export function resetImageIds(): void {
  imageIdCounter = 0;
}
