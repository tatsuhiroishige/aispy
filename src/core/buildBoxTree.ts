import type { ComputedStyle, StyleResolver } from './cssResolver.js';
import type {
  Box,
  BlockBox,
  InlineBox,
  InlineTextBox,
  InlineNewlineBox,
  ImageBox,
} from './boxTree.js';
import { normalizeAnonymousBoxes } from './anonymousBoxes.js';

const SKIP_TAGS = new Set([
  'SCRIPT', 'STYLE', 'NOSCRIPT', 'IFRAME', 'SVG',
  'TEMPLATE', 'HEAD', 'META', 'LINK', 'TITLE',
]);

const BLOCK_DISPLAYS = new Set([
  'block',
  'list-item',
  'flex',
  'inline-block',
  'table',
  'table-row',
  'table-cell',
  'table-header-group',
  'table-row-group',
  'table-footer-group',
  'table-caption',
  'flow-root',
]);

function isInlineDisplay(display: string): boolean {
  return display === 'inline' || display === '';
}

function isSkippedElement(el: Element): boolean {
  return SKIP_TAGS.has(el.tagName);
}

function isHidden(style: ComputedStyle): boolean {
  return style.display === 'none' || style.visibility === 'hidden';
}

function imageDisplayOf(style: ComputedStyle): 'inline' | 'block' {
  return BLOCK_DISPLAYS.has(style.display) ? 'block' : 'inline';
}

function makeBlockBox(computed: ComputedStyle, element: Element | null): BlockBox {
  return {
    kind: 'block',
    computed,
    element,
    parent: null,
    children: [],
    isAnonymous: element === null,
  };
}

function makeInlineBox(computed: ComputedStyle, element: Element | null): InlineBox {
  return {
    kind: 'inline',
    computed,
    element,
    parent: null,
    children: [],
    isAnonymous: element === null,
  };
}

function makeInlineTextBox(computed: ComputedStyle, text: string): InlineTextBox {
  return {
    kind: 'inline-text',
    computed,
    element: null,
    parent: null,
    children: [],
    isAnonymous: true,
    text,
  };
}

function makeInlineNewlineBox(computed: ComputedStyle, element: Element | null): InlineNewlineBox {
  return {
    kind: 'inline-newline',
    computed,
    element,
    parent: null,
    children: [],
    isAnonymous: element === null,
  };
}

function parseDim(attr: string | null): number | undefined {
  if (!attr) return undefined;
  const match = /^(\d+(?:\.\d+)?)/.exec(attr.trim());
  if (!match) return undefined;
  const value = parseFloat(match[1]!);
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

function makeImageBox(
  computed: ComputedStyle,
  element: Element,
  src: string,
  alt: string,
): ImageBox {
  return {
    kind: 'image',
    computed,
    element,
    parent: null,
    children: [],
    isAnonymous: false,
    src,
    alt,
    imageDisplay: imageDisplayOf(computed),
    hintWidth: parseDim(element.getAttribute('width')),
    hintHeight: parseDim(element.getAttribute('height')),
  };
}

function appendChild(parent: Box, child: Box): void {
  child.parent = parent;
  parent.children.push(child);
}

function buildFromNode(
  node: Node,
  parent: Box,
  parentStyle: ComputedStyle,
  resolver: StyleResolver,
): void {
  if (node.nodeType === 3 /* TEXT_NODE */) {
    const text = node.textContent ?? '';
    if (text.length === 0) return;
    appendChild(parent, makeInlineTextBox(parentStyle, text));
    return;
  }

  if (node.nodeType !== 1 /* ELEMENT_NODE */) return;

  const el = node as Element;
  if (isSkippedElement(el)) return;

  const computed = resolver.getComputedStyle(el);
  if (isHidden(computed)) return;

  if (el.tagName === 'BR') {
    appendChild(parent, makeInlineNewlineBox(computed, el));
    return;
  }

  if (el.tagName === 'IMG') {
    // Prefer resolved .src property (jsdom applies baseURI); fall back to raw attr.
    const resolved = (el as HTMLImageElement).src;
    const src = resolved || el.getAttribute('src') || '';
    const alt = el.getAttribute('alt') ?? '';
    const box = makeImageBox(computed, el, src, alt);
    appendChild(parent, box);
    return;
  }

  if (el.tagName === 'INPUT') {
    const inputEl = el as HTMLInputElement;
    const typeAttr = (inputEl.getAttribute('type') ?? 'text').toLowerCase();
    if (typeAttr === 'hidden') return;
    const value = inputEl.getAttribute('value') ?? '';
    const placeholder = inputEl.getAttribute('placeholder') ?? '';
    const widthAttr = inputEl.getAttribute('size');
    const inferredWidth =
      widthAttr && !isNaN(Number(widthAttr)) ? Number(widthAttr) : 20;
    let display: string;
    if (typeAttr === 'submit' || typeAttr === 'button' || typeAttr === 'reset') {
      display = value || placeholder || typeAttr.toUpperCase();
    } else if (typeAttr === 'checkbox') {
      display = inputEl.hasAttribute('checked') ? '[x]' : '[ ]';
    } else if (typeAttr === 'radio') {
      display = inputEl.hasAttribute('checked') ? '(●)' : '( )';
    } else if (typeAttr === 'password') {
      display = value ? '•'.repeat(value.length) : placeholder || ' '.repeat(inferredWidth);
    } else {
      display = value || placeholder || ' '.repeat(inferredWidth);
    }
    const inputBox = makeBlockBox(computed, el);
    appendChild(parent, inputBox);
    const textBox = makeInlineTextBox({ ...computed, display: 'inline' }, display);
    appendChild(inputBox, textBox);
    return;
  }

  if (el.tagName === 'TEXTAREA') {
    const ta = el as HTMLTextAreaElement;
    const value = ta.value || ta.textContent || '';
    const rows = ta.getAttribute('rows');
    const placeholder = ta.getAttribute('placeholder') ?? '';
    const text = value || placeholder || ' '.repeat(30);
    const padded = rows && !isNaN(Number(rows))
      ? text + '\n'.repeat(Math.max(0, Number(rows) - text.split('\n').length))
      : text;
    const taBox = makeBlockBox(computed, el);
    appendChild(parent, taBox);
    const tb = makeInlineTextBox({ ...computed, display: 'inline' }, padded);
    appendChild(taBox, tb);
    return;
  }

  if (el.tagName === 'BUTTON') {
    const btnBox = makeBlockBox(computed, el);
    appendChild(parent, btnBox);
    const label = (el.textContent ?? '').trim() || 'button';
    const tb = makeInlineTextBox({ ...computed, display: 'inline' }, ` ${label} `);
    appendChild(btnBox, tb);
    return;
  }

  if (el.tagName === 'SELECT') {
    const sel = el as HTMLSelectElement;
    const selected = Array.from(sel.querySelectorAll('option'))
      .find((o) => o.hasAttribute('selected'));
    const firstOption = sel.querySelector('option');
    const label = (selected?.textContent ?? firstOption?.textContent ?? '').trim() || '(select)';
    const selBox = makeBlockBox(computed, el);
    appendChild(parent, selBox);
    const tb = makeInlineTextBox({ ...computed, display: 'inline' }, `${label} ▾`);
    appendChild(selBox, tb);
    return;
  }

  const box: Box = isInlineDisplay(computed.display)
    ? makeInlineBox(computed, el)
    : makeBlockBox(computed, el);

  appendChild(parent, box);

  for (const child of Array.from(el.childNodes)) {
    buildFromNode(child, box, computed, resolver);
  }
}

export function buildBoxTree(document: Document, resolver: StyleResolver): BlockBox {
  const root = makeBlockBox(
    {
      display: 'block',
      fontWeight: 'normal',
      color: '',
      textDecoration: 'none',
      marginTop: 0,
      marginBottom: 0,
      paddingLeft: 0,
      textAlign: 'left',
      listStyleType: '',
      whiteSpace: 'normal',
      visibility: 'visible',
    },
    null,
  );

  const body = document.body ?? document.documentElement;
  if (!body) return root;

  for (const child of Array.from(body.childNodes)) {
    buildFromNode(child, root, root.computed, resolver);
  }

  normalizeAnonymousBoxes(root);

  return root;
}
