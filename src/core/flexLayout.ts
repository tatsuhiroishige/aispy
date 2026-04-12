import Yoga from 'yoga-layout';
import type { Node as YogaNode } from 'yoga-layout';

export interface FlexItem {
  width?: number;
  height?: number;
  flexGrow?: number;
  flexShrink?: number;
  flexBasis?: number | 'auto';
  flexDirection?: 'row' | 'column';
  children?: FlexItem[];
  content?: string;
}

export interface LayoutResult {
  x: number;
  y: number;
  width: number;
  height: number;
  children: LayoutResult[];
}

function applyFlexItem(node: YogaNode, item: FlexItem): void {
  if (item.width !== undefined) {
    node.setWidth(item.width);
  }
  if (item.height !== undefined) {
    node.setHeight(item.height);
  }
  if (item.flexGrow !== undefined) {
    node.setFlexGrow(item.flexGrow);
  }
  if (item.flexShrink !== undefined) {
    node.setFlexShrink(item.flexShrink);
  }
  if (item.flexBasis !== undefined) {
    node.setFlexBasis(item.flexBasis);
  }
  if (item.flexDirection !== undefined) {
    node.setFlexDirection(
      item.flexDirection === 'row'
        ? Yoga.FLEX_DIRECTION_ROW
        : Yoga.FLEX_DIRECTION_COLUMN,
    );
  }
}

function buildTree(item: FlexItem): YogaNode {
  const node = Yoga.Node.create();
  applyFlexItem(node, item);

  if (item.children) {
    for (let i = 0; i < item.children.length; i++) {
      const child = buildTree(item.children[i]!);
      node.insertChild(child, i);
    }
  }

  return node;
}

function extractLayout(node: YogaNode): LayoutResult {
  const layout = node.getComputedLayout();
  const children: LayoutResult[] = [];

  for (let i = 0; i < node.getChildCount(); i++) {
    children.push(extractLayout(node.getChild(i)));
  }

  return {
    x: layout.left,
    y: layout.top,
    width: layout.width,
    height: layout.height,
    children,
  };
}

/** Calculate flexbox layout for a tree of FlexItems using Yoga. */
export function calculateFlexLayout(
  root: FlexItem,
  containerWidth: number,
  containerHeight: number,
): LayoutResult {
  const rootNode = buildTree(root);
  rootNode.setWidth(containerWidth);
  rootNode.setHeight(containerHeight);

  rootNode.calculateLayout(containerWidth, containerHeight);
  const result = extractLayout(rootNode);

  rootNode.freeRecursive();
  return result;
}
