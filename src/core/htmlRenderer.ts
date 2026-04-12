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
}

function defaultContext(width: number): RenderContext {
  return { width, indent: 0, listType: null, listCounter: 0, inPre: false };
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

function collectInlineText(node: Node): string {
  if (node.nodeType === 3 /* TEXT_NODE */) {
    return node.textContent ?? '';
  }
  if (node.nodeType !== 1 /* ELEMENT_NODE */) return '';

  const el = node as Element;
  const tag = el.tagName;

  if (SKIP_ELEMENTS.has(tag)) return '';
  if (BLOCK_ELEMENTS.has(tag)) return '';

  switch (tag) {
    case 'BR':
      return '\n';
    case 'A': {
      const href = el.getAttribute('href') ?? '';
      const text = inlineChildren(el);
      if (href && href !== text && !href.startsWith('#') && !href.startsWith('javascript:')) {
        return `${text} (${href})`;
      }
      return text;
    }
    case 'CODE':
      return '`' + inlineChildren(el) + '`';
    case 'IMG': {
      const alt = el.getAttribute('alt');
      return alt ? `[image: ${alt}]` : '';
    }
    default:
      return inlineChildren(el);
  }
}

function inlineChildren(el: Element): string {
  let result = '';
  for (const child of el.childNodes) {
    result += collectInlineText(child);
  }
  return result;
}

function normalizeWhitespace(text: string): string {
  return text.replace(/[ \t]+/g, ' ').replace(/\n /g, '\n').trim();
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

  switch (tag) {
    case 'H1':
    case 'H2':
    case 'H3':
    case 'H4':
    case 'H5':
    case 'H6': {
      const level = parseInt(tag[1]!, 10);
      const prefix = '#'.repeat(level) + ' ';
      const text = inlineChildren(el).trim();
      return [' '.repeat(ctx.indent) + prefix + text];
    }

    case 'P': {
      const text = normalizeWhitespace(inlineChildren(el));
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
      const text = normalizeWhitespace(collectInlineText(el));
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
    const text = collectInlineText(child);
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

function renderTable(table: Element, ctx: RenderContext): string[] {
  const rows: string[][] = [];
  const headerRowIndices: number[] = [];

  function collectRows(parent: Element): void {
    for (const child of parent.children) {
      if (child.tagName === 'THEAD' || child.tagName === 'TBODY' || child.tagName === 'TFOOT') {
        const inHead = child.tagName === 'THEAD';
        for (const tr of child.children) {
          if (tr.tagName === 'TR') {
            if (inHead) headerRowIndices.push(rows.length);
            rows.push(collectCells(tr));
          }
        }
      } else if (child.tagName === 'TR') {
        const cells = collectCells(child);
        // Detect header row by checking if all cells are TH
        const allTh = Array.from(child.children).every(c => c.tagName === 'TH');
        if (allTh && rows.length === 0) headerRowIndices.push(rows.length);
        rows.push(cells);
      }
    }
  }

  function collectCells(tr: Element): string[] {
    const cells: string[] = [];
    for (const cell of tr.children) {
      if (cell.tagName === 'TD' || cell.tagName === 'TH') {
        cells.push(normalizeWhitespace(inlineChildren(cell)));
      }
    }
    return cells;
  }

  collectRows(table);
  if (rows.length === 0) return [];

  // Calculate column widths
  const colCount = Math.max(...rows.map(r => r.length));
  const colWidths: number[] = Array.from({ length: colCount }, () => 0);
  for (const row of rows) {
    for (let i = 0; i < row.length; i++) {
      colWidths[i] = Math.max(colWidths[i]!, row[i]!.length);
    }
  }

  const prefix = ' '.repeat(ctx.indent);
  const lines: string[] = [];

  for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
    const row = rows[rowIdx]!;
    const cells = Array.from({ length: colCount }, (_, i) => {
      const cell = row[i] ?? '';
      return cell.padEnd(colWidths[i]!);
    });
    lines.push(prefix + cells.join(' \u2502 '));

    if (headerRowIndices.includes(rowIdx)) {
      const separator = colWidths.map(w => '\u2500'.repeat(w)).join('\u2500\u253C\u2500');
      lines.push(prefix + separator);
    }
  }

  return [lines.join('\n')];
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

    if (BLOCK_ELEMENTS.has(childEl.tagName)) {
      // Flush pending inline text
      const text = normalizeWhitespace(pendingInline);
      if (text) {
        blocks.push(wordWrap(text, ctx.width, ctx.indent));
      }
      pendingInline = '';
      blocks.push(...renderNode(childEl, ctx));
    } else {
      pendingInline += collectInlineText(childEl);
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
  const ctx = defaultContext(effectiveWidth);
  const body = doc.body;
  if (!body) return '';

  const blocks = renderChildren(body, ctx);
  // Join blocks with blank line separation, trim trailing whitespace per line
  return blocks
    .filter(b => b.length > 0)
    .map(b => b.split('\n').map(line => line.trimEnd()).join('\n'))
    .join('\n\n');
}
