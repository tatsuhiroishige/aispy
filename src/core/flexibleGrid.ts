import type { Box } from './boxTree.js';

export const FF_BOLD = 1 << 0;
export const FF_ITALIC = 1 << 1;
export const FF_UNDERLINE = 1 << 2;
export const FF_REVERSE = 1 << 3;
export const FF_STRIKE = 1 << 4;
export const FF_OVERLINE = 1 << 5;

export interface Format {
  fg: number;
  bg: number;
  flags: number;
  fgTrueColor?: number;
}

export const DEFAULT_FORMAT: Format = { fg: -1, bg: -1, flags: 0 };

export function formatEquals(a: Format, b: Format): boolean {
  return (
    a.fg === b.fg &&
    a.bg === b.bg &&
    a.flags === b.flags &&
    a.fgTrueColor === b.fgTrueColor
  );
}

export interface FormatCell {
  pos: number;
  format: Format;
  sourceBox: Box | null;
}

export interface FlexibleLine {
  str: string;
  formats: FormatCell[];
  prependEscape?: string;
}

export function setLinePrependEscape(
  grid: FlexibleGrid,
  y: number,
  escape: string,
): void {
  while (grid.length <= y) grid.push({ str: '', formats: [] });
  grid[y]!.prependEscape = (grid[y]!.prependEscape ?? '') + escape;
}

export type FlexibleGrid = FlexibleLine[];

export function createGrid(): FlexibleGrid {
  return [];
}

function isCombiningMark(code: number): boolean {
  return (
    (code >= 0x0300 && code <= 0x036f) ||
    (code >= 0x0483 && code <= 0x0489) ||
    (code >= 0x0591 && code <= 0x05bd) ||
    code === 0x05bf ||
    code === 0x05c1 ||
    code === 0x05c2 ||
    code === 0x05c4 ||
    code === 0x05c5 ||
    code === 0x05c7 ||
    (code >= 0x0610 && code <= 0x061a) ||
    (code >= 0x064b && code <= 0x065f) ||
    code === 0x0670 ||
    (code >= 0x06d6 && code <= 0x06dc) ||
    (code >= 0x06df && code <= 0x06e4) ||
    (code >= 0x06e7 && code <= 0x06e8) ||
    (code >= 0x06ea && code <= 0x06ed) ||
    code === 0x0711 ||
    (code >= 0x0730 && code <= 0x074a) ||
    (code >= 0x1ab0 && code <= 0x1aff) ||
    (code >= 0x1dc0 && code <= 0x1dff) ||
    (code >= 0x200b && code <= 0x200f) ||
    (code >= 0x202a && code <= 0x202e) ||
    (code >= 0x2060 && code <= 0x206f) ||
    (code >= 0x20d0 && code <= 0x20ff) ||
    (code >= 0xfe00 && code <= 0xfe0f) ||
    (code >= 0xfe20 && code <= 0xfe2f) ||
    (code >= 0xe0100 && code <= 0xe01ef)
  );
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
  if (isCombiningMark(code)) return 0;
  return 1;
}

function displayWidth(str: string): number {
  let w = 0;
  for (const ch of str) w += charWidth(ch.codePointAt(0) ?? 0);
  return w;
}

function ensureLine(grid: FlexibleGrid, y: number): FlexibleLine {
  while (grid.length <= y) {
    grid.push({ str: '', formats: [] });
  }
  return grid[y]!;
}

function xToStrIndex(str: string, x: number): { index: number; padWidth: number } {
  let w = 0;
  let i = 0;
  for (const ch of str) {
    const cw = charWidth(ch.codePointAt(0) ?? 0);
    if (w >= x && cw > 0) return { index: i, padWidth: 0 };
    if (w + cw > x) {
      return { index: i, padWidth: x - w };
    }
    w += cw;
    i += ch.length;
  }
  return { index: str.length, padWidth: x - w };
}

function pushFormatIfChanged(
  line: FlexibleLine,
  pos: number,
  format: Format,
  sourceBox: Box | null,
): void {
  const last = line.formats[line.formats.length - 1];
  if (last && last.pos === pos) {
    last.format = format;
    last.sourceBox = sourceBox;
    return;
  }
  if (last && formatEquals(last.format, format) && last.sourceBox === sourceBox) {
    return;
  }
  line.formats.push({ pos, format, sourceBox });
}

export function setText(
  grid: FlexibleGrid,
  x: number,
  y: number,
  text: string,
  format: Format = DEFAULT_FORMAT,
  sourceBox: Box | null = null,
): void {
  if (text.length === 0) return;
  const line = ensureLine(grid, y);

  const { index, padWidth } = xToStrIndex(line.str, x);

  const lead = line.str.slice(0, index);
  const pad = padWidth > 0 ? ' '.repeat(padWidth) : '';
  const paddingNeeded = x - displayWidth(lead);
  const leftPad = paddingNeeded > padWidth ? ' '.repeat(paddingNeeded - padWidth) : '';

  const preTrailingStart = index;
  const textWidth = displayWidth(text);
  let consumedWidth = 0;
  let trailingCut = preTrailingStart;
  for (const ch of line.str.slice(preTrailingStart)) {
    const cw = charWidth(ch.codePointAt(0) ?? 0);
    if (consumedWidth >= textWidth && cw > 0) break;
    consumedWidth += cw;
    trailingCut += ch.length;
  }
  const trailing = line.str.slice(trailingCut);

  line.str = lead + leftPad + pad + text + trailing;

  const newPos = (lead + leftPad + pad).length;
  pushFormatIfChanged(line, newPos, format, sourceBox);
  pushFormatIfChanged(line, newPos + text.length, DEFAULT_FORMAT, null);
}

export function formatAt(line: FlexibleLine, strPos: number): FormatCell | null {
  let active: FormatCell | null = null;
  for (const f of line.formats) {
    if (f.pos > strPos) break;
    active = f;
  }
  return active;
}

export function sourceBoxAt(grid: FlexibleGrid, x: number, y: number): Box | null {
  if (y < 0 || y >= grid.length) return null;
  const line = grid[y]!;
  const { index } = xToStrIndex(line.str, x);
  const cell = formatAt(line, index);
  return cell?.sourceBox ?? null;
}
