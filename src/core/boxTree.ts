import type { ComputedStyle } from './cssResolver.js';

export type BoxKind =
  | 'block'
  | 'inline'
  | 'inline-text'
  | 'inline-newline'
  | 'image';

interface BaseBox {
  computed: ComputedStyle;
  element: Element | null;
  parent: Box | null;
  children: Box[];
  isAnonymous: boolean;
}

export interface BlockBox extends BaseBox {
  kind: 'block';
}

export interface InlineBox extends BaseBox {
  kind: 'inline';
}

export interface InlineTextBox extends BaseBox {
  kind: 'inline-text';
  text: string;
}

export interface InlineNewlineBox extends BaseBox {
  kind: 'inline-newline';
}

export interface ImageBox extends BaseBox {
  kind: 'image';
  src: string;
  alt: string;
  imageDisplay: 'inline' | 'block';
}

export type Box =
  | BlockBox
  | InlineBox
  | InlineTextBox
  | InlineNewlineBox
  | ImageBox;

export function isBlock(box: Box): box is BlockBox {
  return box.kind === 'block';
}

export function isInline(box: Box): box is InlineBox {
  return box.kind === 'inline';
}

export function isInlineText(box: Box): box is InlineTextBox {
  return box.kind === 'inline-text';
}

export function isInlineLike(box: Box): box is InlineBox | InlineTextBox | InlineNewlineBox {
  return (
    box.kind === 'inline' ||
    box.kind === 'inline-text' ||
    box.kind === 'inline-newline'
  );
}

export function isImage(box: Box): box is ImageBox {
  return box.kind === 'image';
}
