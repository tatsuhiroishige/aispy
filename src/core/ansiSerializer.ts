import {
  type FlexibleGrid,
  type Format,
  type FormatCell,
  DEFAULT_FORMAT,
  FF_BOLD,
  FF_ITALIC,
  FF_UNDERLINE,
  FF_REVERSE,
  FF_STRIKE,
  FF_OVERLINE,
  formatEquals,
} from './flexibleGrid.js';

const ESC = '\x1b[';

function fgSeq(format: Format): string {
  if (format.fgTrueColor !== undefined) {
    const r = (format.fgTrueColor >> 16) & 0xff;
    const g = (format.fgTrueColor >> 8) & 0xff;
    const b = format.fgTrueColor & 0xff;
    return `38;2;${r};${g};${b}`;
  }
  const fg = format.fg;
  if (fg < 0) return '39';
  if (fg < 8) return `${30 + fg}`;
  if (fg < 16) return `${90 + (fg - 8)}`;
  return `38;5;${fg}`;
}

function bgSeq(bg: number): string {
  if (bg < 0) return '49';
  if (bg < 8) return `${40 + bg}`;
  if (bg < 16) return `${100 + (bg - 8)}`;
  return `48;5;${bg}`;
}

function flagsOpen(flags: number): string[] {
  const codes: string[] = [];
  if (flags & FF_BOLD) codes.push('1');
  if (flags & FF_ITALIC) codes.push('3');
  if (flags & FF_UNDERLINE) codes.push('4');
  if (flags & FF_REVERSE) codes.push('7');
  if (flags & FF_STRIKE) codes.push('9');
  if (flags & FF_OVERLINE) codes.push('53');
  return codes;
}

function emitFormat(format: Format): string {
  if (formatEquals(format, DEFAULT_FORMAT)) return `${ESC}0m`;
  const parts = ['0', ...flagsOpen(format.flags), fgSeq(format), bgSeq(format.bg)];
  return `${ESC}${parts.join(';')}m`;
}

function serializeLine(line: {
  str: string;
  formats: FormatCell[];
  prependEscape?: string;
}): string {
  const prefix = line.prependEscape ?? '';
  if (line.str.length === 0) return prefix;

  const formats = line.formats.slice().sort((a, b) => a.pos - b.pos);
  let out = '';
  let current: Format = DEFAULT_FORMAT;
  let fi = 0;

  for (let i = 0; i < line.str.length; i++) {
    while (fi < formats.length && formats[fi]!.pos <= i) {
      const next = formats[fi]!.format;
      if (!formatEquals(next, current)) {
        out += emitFormat(next);
        current = next;
      }
      fi++;
    }
    out += line.str[i];
  }

  if (!formatEquals(current, DEFAULT_FORMAT)) {
    out += `${ESC}0m`;
  }

  return prefix + out;
}

export function serializeGrid(grid: FlexibleGrid): string {
  return grid.map(serializeLine).join('\n');
}
