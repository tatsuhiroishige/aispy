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
