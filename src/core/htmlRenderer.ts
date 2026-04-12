import { createStyleResolver } from './cssResolver.js';
import type { StyleResolver } from './cssResolver.js';

const SKIP_ELEMENTS = new Set([
  'SCRIPT', 'STYLE', 'NAV', 'FOOTER', 'HEADER',
  'FORM', 'INPUT', 'BUTTON', 'SELECT', 'TEXTAREA',
  'NOSCRIPT', 'IFRAME', 'SVG',
]);

const BLOCK_ELEMENTS = new Set([
  'P', 'DIV', 'SECTION', 'ARTICLE', 'MAIN', 'ASIDE',
  'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
  'BLOCKQUOTE', 'PRE', 'UL', 'OL', 'LI',
  'TABLE', 'TR', 'THEAD', 'TBODY', 'TFOOT',
  'HR', 'FIGURE', 'FIGCAPTION', 'DD', 'DT', 'DL',
  'ADDRESS', 'DETAILS', 'SUMMARY',
]);

interface RenderContext {
  width: number;
  indent: number;
  listType: 'ul' | 'ol' | null;
  listCounter: number;
  inPre: boolean;
  styles: StyleResolver | null;
}

function defaultContext(width: number, styles: StyleResolver | null): RenderContext {
  return { width, indent: 0, listType: null, listCounter: 0, inPre: false, styles };
}

function wordWrap(text: string, maxWidth: number, indent: number): string {
  const available = Math.max(maxWidth - indent, 20);
  const prefix = ' '.repeat(indent);
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return '';

  const lines: string[] = [];
  let currentLine = words[0]!;

  for (let i = 1; i < words.length; i++) {
    const word = words[i]!;
    if (currentLine.length + 1 + word.length <= available) {
      currentLine += ' ' + word;
    } else {
      lines.push(prefix + currentLine);
      currentLine = word;
    }
  }
  lines.push(prefix + currentLine);
  return lines.join('\n');
}

function collectInlineText(node: Node, styles?: StyleResolver | null): string {
  if (node.nodeType === 3 /* TEXT_NODE */) {
    return node.textContent ?? '';
  }
  if (node.nodeType !== 1 /* ELEMENT_NODE */) return '';

  const el = node as Element;
  const tag = el.tagName;

  if (SKIP_ELEMENTS.has(tag)) return '';
  if (BLOCK_ELEMENTS.has(tag)) return '';

  // CSS-based hiding for inline elements
  if (styles) {
    const computed = styles.getComputedStyle(el);
    if (computed.display === 'none' || computed.visibility === 'hidden') return '';
  }

  switch (tag) {
    case 'BR':
      return '\n';
    case 'A': {
      const href = el.getAttribute('href') ?? '';
      const text = inlineChildren(el, styles);
      if (href && href !== text && !href.startsWith('#') && !href.startsWith('javascript:')) {
        return `${text} (${href})`;
      }
      return text;
    }
    case 'CODE':
      return '`' + inlineChildren(el, styles) + '`';
    case 'IMG': {
      const alt = el.getAttribute('alt');
      return alt ? `[image: ${alt}]` : '';
    }
    default:
      return inlineChildren(el, styles);
  }
}

function inlineChildren(el: Element, styles?: StyleResolver | null): string {
  let result = '';
  for (const child of el.childNodes) {
    result += collectInlineText(child, styles);
  }
  return result;
}

function normalizeWhitespace(text: string): string {
  return text.replace(/[ \t]+/g, ' ').replace(/\n /g, '\n').trim();
}

function isCssHidden(el: Element, ctx: RenderContext): boolean {
  if (!ctx.styles) return false;
  const computed = ctx.styles.getComputedStyle(el);
  return computed.display === 'none' || computed.visibility === 'hidden';
}

function renderNode(node: Node, ctx: RenderContext): string[] {
  if (node.nodeType === 3 /* TEXT_NODE */) {
    const text = node.textContent ?? '';
    if (ctx.inPre) {
      const indentStr = '  '.repeat(Math.max(1, ctx.indent));
      return text.split('\n').map(line => indentStr + line);
    }
    const normalized = normalizeWhitespace(text);
    if (!normalized) return [];
    return [wordWrap(normalized, ctx.width, ctx.indent)];
  }

  if (node.nodeType !== 1 /* ELEMENT_NODE */) return [];

  const el = node as Element;
  const tag = el.tagName;

  if (SKIP_ELEMENTS.has(tag)) return [];

  // CSS-based hiding: skip elements with display:none or visibility:hidden
  if (isCssHidden(el, ctx)) return [];

  switch (tag) {
    case 'H1':
    case 'H2':
    case 'H3':
    case 'H4':
    case 'H5':
    case 'H6': {
      const level = parseInt(tag[1]!, 10);
      const prefix = '#'.repeat(level) + ' ';
      const text = inlineChildren(el, ctx.styles).trim();
      return [' '.repeat(ctx.indent) + prefix + text];
    }

    case 'P': {
      const text = normalizeWhitespace(inlineChildren(el, ctx.styles));
      if (!text) return [];
      return [wordWrap(text, ctx.width, ctx.indent)];
    }

    case 'BLOCKQUOTE': {
      const innerBlocks = renderChildren(el, {
        ...ctx,
        indent: 0,
        width: ctx.width - ctx.indent - 4,
      });
      const prefix = ' '.repeat(ctx.indent) + '\u2502 ';
      return innerBlocks.map(block =>
        block.split('\n').map(line => prefix + line).join('\n')
      );
    }

    case 'PRE': {
      const code = el.querySelector('code');
      const source = code ?? el;
      const rawText = source.textContent ?? '';
      const indentStr = ' '.repeat(ctx.indent + 2);
      const lines = rawText.split('\n');
      // Trim leading/trailing empty lines
      while (lines.length > 0 && lines[0]!.trim() === '') lines.shift();
      while (lines.length > 0 && lines[lines.length - 1]!.trim() === '') lines.pop();
      return [lines.map(line => indentStr + line).join('\n')];
    }

    case 'UL': {
      const blocks: string[] = [];
      let childIdx = 0;
      for (const child of el.children) {
        if (child.tagName === 'LI') {
          blocks.push(...renderListItem(child, {
            ...ctx,
            listType: 'ul',
            listCounter: childIdx,
            indent: ctx.indent + 2,
          }));
          childIdx++;
        }
      }
      return blocks;
    }

    case 'OL': {
      const blocks: string[] = [];
      let counter = 1;
      const startAttr = el.getAttribute('start');
      if (startAttr) {
        const parsed = parseInt(startAttr, 10);
        if (!isNaN(parsed)) counter = parsed;
      }
      for (const child of el.children) {
        if (child.tagName === 'LI') {
          blocks.push(...renderListItem(child, {
            ...ctx,
            listType: 'ol',
            listCounter: counter,
            indent: ctx.indent + 2,
          }));
          counter++;
        }
      }
      return blocks;
    }

    case 'TABLE':
      return renderTable(el, ctx);

    case 'HR':
      return [' '.repeat(ctx.indent) + '\u2500'.repeat(Math.min(40, ctx.width - ctx.indent))];

    case 'BR':
      return [''];

    case 'A':
    case 'STRONG':
    case 'B':
    case 'EM':
    case 'I':
    case 'CODE':
    case 'SPAN':
    case 'SMALL':
    case 'SUB':
    case 'SUP':
    case 'ABBR':
    case 'TIME':
    case 'MARK':
    case 'DEL':
    case 'INS':
    case 'S':
    case 'U':
    case 'IMG': {
      const text = normalizeWhitespace(collectInlineText(el, ctx.styles));
      if (!text) return [];
      return [wordWrap(text, ctx.width, ctx.indent)];
    }

    default:
      return renderChildren(el, ctx);
  }
}

function renderListItem(li: Element, ctx: RenderContext): string[] {
  const marker = ctx.listType === 'ol'
    ? `${ctx.listCounter}. `
    : '- ';
  const markerIndent = ' '.repeat(ctx.indent);

  // Collect inline content and nested blocks separately
  const inlineParts: string[] = [];
  const nestedBlocks: string[] = [];

  for (const child of li.childNodes) {
    if (child.nodeType === 1) {
      const childEl = child as Element;
      if (childEl.tagName === 'UL' || childEl.tagName === 'OL') {
        nestedBlocks.push(...renderNode(childEl, {
          ...ctx,
          indent: ctx.indent + 2,
        }));
        continue;
      }
      if (BLOCK_ELEMENTS.has(childEl.tagName)) {
        const blockResult = renderNode(childEl, { ...ctx });
        nestedBlocks.push(...blockResult);
        continue;
      }
    }
    const text = collectInlineText(child, ctx.styles);
    if (text.trim()) inlineParts.push(text);
  }

  const blocks: string[] = [];
  const inlineText = normalizeWhitespace(inlineParts.join(''));
  if (inlineText) {
    const firstLineAvail = ctx.width - ctx.indent - marker.length;
    const wrapped = wordWrap(inlineText, firstLineAvail + ctx.indent, 0);
    const wrappedLines = wrapped.split('\n');
    const contIndent = ' '.repeat(ctx.indent + marker.length);
    const firstLine = markerIndent + marker + wrappedLines[0]!.trimStart();
    const rest = wrappedLines.slice(1).map(l => contIndent + l.trimStart());
    blocks.push([firstLine, ...rest].join('\n'));
  }
  blocks.push(...nestedBlocks);

  return blocks;
}

const MIN_COL_WIDTH = 5;

function isNumeric(text: string): boolean {
  return /^\s*-?[\d,]+\.?\d*%?\s*$/.test(text) || /^\s*[\d.]+[KMGTBkb]+\s*$/.test(text);
}

function renderTable(table: Element, ctx: RenderContext): string[] {
  const rows: string[][] = [];
  const headerRowIndices: number[] = [];
  let hasExplicitHeader = false;

  function collectRows(parent: Element): void {
    for (const child of parent.children) {
      if (child.tagName === 'THEAD' || child.tagName === 'TBODY' || child.tagName === 'TFOOT') {
        if (child.tagName === 'THEAD') hasExplicitHeader = true;
        const inHead = child.tagName === 'THEAD';
        for (const tr of child.children) {
          if (tr.tagName === 'TR') {
            if (inHead) headerRowIndices.push(rows.length);
            rows.push(collectCells(tr));
          }
        }
      } else if (child.tagName === 'TR') {
        const cells = collectCells(child);
        const allTh = Array.from(child.children).every(c => c.tagName === 'TH');
        if (allTh) {
          hasExplicitHeader = true;
          headerRowIndices.push(rows.length);
        }
        rows.push(cells);
      }
    }
  }

  function collectCells(tr: Element): string[] {
    const cells: string[] = [];
    for (const cell of tr.children) {
      if (cell.tagName === 'TD' || cell.tagName === 'TH') {
        cells.push(normalizeWhitespace(inlineChildren(cell, ctx.styles)));
      }
    }
    return cells;
  }

  collectRows(table);
  if (rows.length === 0) return [];

  // If no explicit header, treat first row as header
  if (!hasExplicitHeader && rows.length > 1) {
    headerRowIndices.push(0);
  }

  const colCount = Math.max(...rows.map(r => r.length));

  // Calculate natural column widths (max content per column)
  const naturalWidths: number[] = Array.from({ length: colCount }, () => 0);
  for (const row of rows) {
    for (let i = 0; i < row.length; i++) {
      naturalWidths[i] = Math.max(naturalWidths[i]!, row[i]!.length);
    }
  }

  // Each column has 1-space padding on each side, plus border chars
  // Total width = indent + 1 (left border) + sum(colWidth + 2 padding) + (colCount-1) * 1 (inner borders) + 1 (right border)
  // = indent + 2 + colCount * (colWidth_i + 2) + (colCount - 1)
  // = indent + 2 + sum(colWidth_i + 2) + colCount - 1
  const overhead = ctx.indent + 1 + colCount * 2 + (colCount - 1) + 1;
  // = indent + colCount * 3
  const availableForContent = ctx.width - overhead;

  const colWidths = distributeColumnWidths(naturalWidths, availableForContent);

  // Detect numeric columns from data rows (exclude header rows)
  const numericCols: boolean[] = Array.from({ length: colCount }, () => false);
  for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
    if (headerRowIndices.includes(rowIdx)) continue;
    const row = rows[rowIdx]!;
    for (let i = 0; i < row.length; i++) {
      if (row[i] && isNumeric(row[i]!)) {
        numericCols[i] = true;
      }
    }
  }
  // Only mark as numeric if ALL data cells in the column are numeric
  for (let i = 0; i < colCount; i++) {
    let allNumeric = true;
    let hasData = false;
    for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
      if (headerRowIndices.includes(rowIdx)) continue;
      const cell = rows[rowIdx]![i] ?? '';
      if (cell === '') continue;
      hasData = true;
      if (!isNumeric(cell)) {
        allNumeric = false;
        break;
      }
    }
    numericCols[i] = hasData && allNumeric;
  }

  const prefix = ' '.repeat(ctx.indent);

  function makeHLine(left: string, mid: string, right: string): string {
    const segments = colWidths.map(w => '\u2500'.repeat(w + 2));
    return prefix + left + segments.join(mid) + right;
  }

  function formatRow(row: string[], rowIdx: number): string {
    const cells = Array.from({ length: colCount }, (_, i) => {
      const text = row[i] ?? '';
      const w = colWidths[i]!;
      let content = text;
      if (content.length > w) {
        content = content.slice(0, w - 1) + '\u2026';
      }
      // Right-align numeric data cells, left-align headers
      if (numericCols[i] && !headerRowIndices.includes(rowIdx)) {
        return ' ' + content.padStart(w) + ' ';
      }
      return ' ' + content.padEnd(w) + ' ';
    });
    return prefix + '\u2502' + cells.join('\u2502') + '\u2502';
  }

  const lines: string[] = [];

  // Top border
  lines.push(makeHLine('\u250C', '\u252C', '\u2510'));

  for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
    lines.push(formatRow(rows[rowIdx]!, rowIdx));

    if (headerRowIndices.includes(rowIdx)) {
      // Header separator
      lines.push(makeHLine('\u251C', '\u253C', '\u2524'));
    }
  }

  // Bottom border
  lines.push(makeHLine('\u2514', '\u2534', '\u2518'));

  return [lines.join('\n')];
}

function distributeColumnWidths(naturalWidths: number[], available: number): number[] {
  const colCount = naturalWidths.length;
  const totalNatural = naturalWidths.reduce((a, b) => a + b, 0);

  if (totalNatural <= available) {
    return naturalWidths.map(w => Math.max(w, MIN_COL_WIDTH));
  }

  // Shrink: give MIN_COL_WIDTH to small columns, distribute rest proportionally
  const result = naturalWidths.map(w => Math.max(w, MIN_COL_WIDTH));
  const minTotal = result.reduce((a, b) => a + b, 0);

  if (minTotal <= available) {
    // We have budget to shrink large columns to fit
    // Find columns that need shrinking (those above MIN_COL_WIDTH that are larger than their fair share)
    let excess = minTotal - available;
    // Shrink from largest to smallest, taking proportional cuts
    const indexed = result.map((w, i) => ({ w, i })).sort((a, b) => b.w - a.w);
    for (const entry of indexed) {
      if (excess <= 0) break;
      if (entry.w <= MIN_COL_WIDTH) continue;
      const shrinkable = entry.w - MIN_COL_WIDTH;
      const cut = Math.min(shrinkable, excess);
      result[entry.i] = entry.w - cut;
      excess -= cut;
    }
    return result;
  }

  // Even minimums exceed available — give each MIN_COL_WIDTH
  return Array.from({ length: colCount }, () => MIN_COL_WIDTH);
}

function renderChildren(el: Element, ctx: RenderContext): string[] {
  const blocks: string[] = [];
  let pendingInline = '';

  for (const child of el.childNodes) {
    if (child.nodeType === 3 /* TEXT_NODE */) {
      pendingInline += child.textContent ?? '';
      continue;
    }
    if (child.nodeType !== 1) continue;

    const childEl = child as Element;
    if (SKIP_ELEMENTS.has(childEl.tagName)) continue;

    // CSS-based hiding in renderChildren
    if (isCssHidden(childEl, ctx)) continue;

    if (BLOCK_ELEMENTS.has(childEl.tagName)) {
      // Flush pending inline text
      const text = normalizeWhitespace(pendingInline);
      if (text) {
        blocks.push(wordWrap(text, ctx.width, ctx.indent));
      }
      pendingInline = '';
      blocks.push(...renderNode(childEl, ctx));
    } else {
      pendingInline += collectInlineText(childEl, ctx.styles);
    }
  }

  // Flush trailing inline text
  const text = normalizeWhitespace(pendingInline);
  if (text) {
    blocks.push(wordWrap(text, ctx.width, ctx.indent));
  }

  return blocks;
}

/** Walk a DOM Document and produce layout-aware terminal text. */
export function renderHtmlToTerminal(doc: Document, width?: number): string {
  const effectiveWidth = width ?? 80;
  const styles = createStyleResolver(doc);
  const ctx = defaultContext(effectiveWidth, styles);
  const body = doc.body;
  if (!body) return '';

  const blocks = renderChildren(body, ctx);
  // Join blocks with blank line separation, trim trailing whitespace per line
  return blocks
    .filter(b => b.length > 0)
    .map(b => b.split('\n').map(line => line.trimEnd()).join('\n'))
    .join('\n\n');
}
