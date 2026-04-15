import type { Box, BlockBox, InlineBox, InlineTextBox } from './boxTree.js';
import type { ComputedStyle } from './cssResolver.js';

function isInlineLevel(box: Box): boolean {
  if (box.kind === 'inline' || box.kind === 'inline-text' || box.kind === 'inline-newline') {
    return true;
  }
  if (box.kind === 'image') return box.imageDisplay === 'inline';
  return false;
}

function isBlockLevel(box: Box): boolean {
  return !isInlineLevel(box);
}

function isFlexContainer(box: Box): boolean {
  return (
    box.kind === 'block' &&
    (box.computed.display === 'flex' || box.computed.display === 'inline-flex')
  );
}

function hasAny(children: Box[], pred: (b: Box) => boolean): boolean {
  for (const c of children) if (pred(c)) return true;
  return false;
}

function makeAnonymousBlock(inherited: ComputedStyle): BlockBox {
  return {
    kind: 'block',
    computed: { ...inherited, display: 'block' },
    element: null,
    parent: null,
    children: [],
    isAnonymous: true,
  };
}

function hasBlockDescendant(box: Box): boolean {
  for (const c of box.children) {
    if (isBlockLevel(c)) return true;
    if (c.kind === 'inline' && hasBlockDescendant(c)) return true;
  }
  return false;
}

function cloneInlineFragment(src: InlineBox): InlineBox {
  return {
    kind: 'inline',
    computed: src.computed,
    element: src.element,
    parent: src.parent,
    children: [],
    isAnonymous: true,
  };
}

function splitInlineAroundBlocks(inline: InlineBox): Box[] {
  const segments: Box[] = [];
  let fragment: InlineBox | null = null;

  const flush = (): void => {
    if (fragment && fragment.children.length > 0) segments.push(fragment);
    fragment = null;
  };

  for (const child of inline.children) {
    if (isBlockLevel(child)) {
      flush();
      segments.push(child);
      continue;
    }
    if (child.kind === 'inline' && hasBlockDescendant(child)) {
      flush();
      const innerSplit = splitInlineAroundBlocks(child);
      for (const seg of innerSplit) segments.push(seg);
      continue;
    }
    if (!fragment) fragment = cloneInlineFragment(inline);
    child.parent = fragment;
    fragment.children.push(child);
  }
  flush();

  if (segments.length === 0) return [inline];
  return segments;
}

function splitBlockChildrenInInlines(parent: BlockBox): void {
  const newChildren: Box[] = [];
  let changed = false;
  for (const child of parent.children) {
    if (child.kind === 'inline' && hasBlockDescendant(child)) {
      const split = splitInlineAroundBlocks(child);
      for (const seg of split) {
        seg.parent = parent;
        newChildren.push(seg);
      }
      changed = true;
    } else {
      newChildren.push(child);
    }
  }
  if (changed) parent.children = newChildren;
}

function wrapInlineRuns(parent: BlockBox): void {
  const hasBlock = hasAny(parent.children, isBlockLevel);
  const hasInline = hasAny(parent.children, isInlineLevel);
  const isFlex = isFlexContainer(parent);

  const shouldWrap = isFlex ? hasInline : hasBlock && hasInline;
  if (!shouldWrap) return;

  const normalized: Box[] = [];
  let run: Box[] | null = null;

  const flushRun = (): void => {
    if (run && run.length > 0) {
      const anon = makeAnonymousBlock(parent.computed);
      anon.parent = parent;
      for (const child of run) {
        child.parent = anon;
        anon.children.push(child);
      }
      normalized.push(anon);
    }
    run = null;
  };

  for (const child of parent.children) {
    if (isInlineLevel(child)) {
      if (!run) run = [];
      run.push(child);
    } else {
      flushRun();
      normalized.push(child);
    }
  }
  flushRun();

  parent.children = normalized;
}

function computeMarker(style: string, index: number): string {
  switch (style) {
    case 'disc':
      return '• ';
    case 'circle':
      return '◦ ';
    case 'square':
      return '▪ ';
    case 'decimal':
      return `${index + 1}. `;
    case 'lower-alpha':
    case 'lower-latin':
      return `${String.fromCharCode(97 + (index % 26))}. `;
    case 'upper-alpha':
    case 'upper-latin':
      return `${String.fromCharCode(65 + (index % 26))}. `;
    case 'none':
    case '':
      return '';
    default:
      return '• ';
  }
}

function makeMarkerBox(inherited: ComputedStyle, text: string): InlineTextBox {
  return {
    kind: 'inline-text',
    computed: { ...inherited, display: 'inline' },
    element: null,
    parent: null,
    children: [],
    isAnonymous: true,
    text,
  };
}

function insertMarkers(parent: Box): void {
  if (parent.kind !== 'block' && parent.kind !== 'inline') return;
  const parentListStyle = parent.computed.listStyleType;
  let liIndex = 0;
  for (const child of parent.children) {
    if (child.kind === 'block' && child.computed.display === 'list-item') {
      // list-style-type is inherited in CSS; cssResolver does not implement
      // inheritance yet, so fall back to parent's value when li has no own.
      const style = child.computed.listStyleType || parentListStyle;
      const text = computeMarker(style, liIndex);
      if (text.length > 0) {
        const marker = makeMarkerBox(child.computed, text);
        marker.parent = child;
        child.children.unshift(marker);
      }
      liIndex++;
    }
  }
}

export function normalizeAnonymousBoxes(box: Box): void {
  if (box.kind === 'block') {
    splitBlockChildrenInInlines(box);
    wrapInlineRuns(box);
  }
  insertMarkers(box);
  for (const child of box.children) {
    normalizeAnonymousBoxes(child);
  }
}
