import type { Box, BlockBox } from './boxTree.js';
import type { ExclusionList } from './floats.js';
import { isFloated } from './floats.js';

export interface LineAtom {
  x: number;
  width: number;
  text: string;
  sourceBox: Box;
}

export interface LineBox {
  offsetY: number;
  height: number;
  width: number;
  atoms: LineAtom[];
}

function charWidth(code: number): number {
  if (
    (code >= 0x1100 && code <= 0x115f) ||
    (code >= 0x2e80 && code <= 0x303e) ||
    (code >= 0x3040 && code <= 0x9fff) ||
    (code >= 0xac00 && code <= 0xd7af) ||
    (code >= 0xf900 && code <= 0xfaff) ||
    (code >= 0xfe10 && code <= 0xfe6f) ||
    (code >= 0xff01 && code <= 0xff60) ||
    (code >= 0xffe0 && code <= 0xffe6) ||
    (code >= 0x20000 && code <= 0x2fffd) ||
    (code >= 0x30000 && code <= 0x3fffd)
  ) return 2;
  if (code < 0x20) return 0;
  return 1;
}

function displayWidth(str: string): number {
  let w = 0;
  for (const ch of str) w += charWidth(ch.codePointAt(0) ?? 0);
  return w;
}

function isCjk(code: number): boolean {
  return charWidth(code) === 2;
}

interface InlineAtom {
  kind: 'text' | 'newline';
  text: string;
  sourceBox: Box;
}

function flattenInlines(box: Box, atoms: InlineAtom[], cellPixelWidth: number): void {
  if (box.kind === 'inline-text') {
    atoms.push({ kind: 'text', text: box.text, sourceBox: box });
    return;
  }
  if (box.kind === 'inline-newline') {
    atoms.push({ kind: 'newline', text: '\n', sourceBox: box });
    return;
  }
  if (box.kind === 'image') {
    const { getDecodedImage } = imageStoreRef;
    const decoded = getDecodedImage ? getDecodedImage(box) : undefined;
    if (decoded) {
      const cellW = Math.max(1, Math.ceil(decoded.width / Math.max(1, cellPixelWidth)));
      atoms.push({ kind: 'text', text: ' '.repeat(cellW), sourceBox: box });
    } else {
      atoms.push({
        kind: 'text',
        text: box.alt || '[image]',
        sourceBox: box,
      });
    }
    return;
  }
  for (const c of box.children) flattenInlines(c, atoms, cellPixelWidth);
}

// Lazy ref to avoid circular import at module load time
const imageStoreRef: {
  getDecodedImage?: (box: Box & { kind: 'image' }) => { width: number; height: number; data: Buffer } | undefined;
} = {};

export function setImageStoreRef(
  fn: (box: Box & { kind: 'image' }) => { width: number; height: number; data: Buffer } | undefined,
): void {
  imageStoreRef.getDecodedImage = fn;
}

function splitOversizedToken(token: string, maxWidth: number): string[] {
  if (displayWidth(token) <= maxWidth) return [token];
  const parts: string[] = [];
  let buf = '';
  let bufW = 0;
  for (const ch of token) {
    const cw = charWidth(ch.codePointAt(0) ?? 0);
    if (bufW + cw > maxWidth && buf.length > 0) {
      parts.push(buf);
      buf = ch;
      bufW = cw;
    } else {
      buf += ch;
      bufW += cw;
    }
  }
  if (buf.length > 0) parts.push(buf);
  return parts;
}

function tokenize(text: string): string[] {
  const tokens: string[] = [];
  let buf = '';
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    if (isCjk(code)) {
      if (buf.length > 0) {
        tokens.push(buf);
        buf = '';
      }
      tokens.push(ch);
    } else if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
      if (buf.length > 0) {
        tokens.push(buf);
        buf = '';
      }
      tokens.push(' ');
    } else {
      buf += ch;
    }
  }
  if (buf.length > 0) tokens.push(buf);
  return tokens;
}

export function layoutInline(
  box: BlockBox,
  maxWidth: number,
  cellPixelWidth = 10,
  exclusions?: ExclusionList,
): { lines: LineBox[]; height: number } {
  const atoms: InlineAtom[] = [];
  for (const c of box.children) {
    if (isFloated(c)) continue;
    flattenInlines(c, atoms, cellPixelWidth);
  }

  const lines: LineBox[] = [];
  let currentAtoms: LineAtom[] = [];
  let currentWidth = 0;
  let y = 0;

  // Per-line available area derived from exclusions at y.
  let lineOffsetX = 0;
  let lineMaxWidth = maxWidth;

  const recomputeLineBounds = (): void => {
    if (!exclusions) {
      lineOffsetX = 0;
      lineMaxWidth = maxWidth;
      return;
    }
    const { x, width } = exclusions.availableAt(y, maxWidth);
    lineOffsetX = x;
    lineMaxWidth = width;
  };

  const finishLine = (): void => {
    while (
      currentAtoms.length > 0 &&
      currentAtoms[currentAtoms.length - 1]!.text === ' '
    ) {
      const removed = currentAtoms.pop();
      if (removed) currentWidth -= removed.width;
    }
    const lineHeight = 1;
    // Shift every atom by the line's left float offset so paint places them
    // to the right of left floats.
    if (lineOffsetX > 0) {
      for (const atom of currentAtoms) atom.x += lineOffsetX;
    }
    lines.push({
      offsetY: y,
      height: lineHeight,
      width: currentWidth + lineOffsetX,
      atoms: currentAtoms,
    });
    y += lineHeight;
    currentAtoms = [];
    currentWidth = 0;
    recomputeLineBounds();
  };

  recomputeLineBounds();

  for (const atom of atoms) {
    if (atom.kind === 'newline') {
      finishLine();
      continue;
    }
    const tokens = tokenize(atom.text);
    for (const token of tokens) {
      const pieces = splitOversizedToken(token, lineMaxWidth);
      for (const piece of pieces) {
        const tw = displayWidth(piece);
        if (piece === ' ' && currentWidth === 0) continue;
        if (currentWidth + tw > lineMaxWidth && currentWidth > 0) {
          finishLine();
          if (piece === ' ') continue;
        }
        currentAtoms.push({
          x: currentWidth,
          width: tw,
          text: piece,
          sourceBox: atom.sourceBox,
        });
        currentWidth += tw;
      }
    }
  }

  if (currentAtoms.length > 0) finishLine();

  return { lines, height: y };
}
