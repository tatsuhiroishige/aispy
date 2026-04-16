import * as csstree from 'css-tree';

export interface ComputedStyle {
  display: string;
  fontWeight: string;
  color: string;
  textDecoration: string;
  marginTop: number;
  marginBottom: number;
  paddingLeft: number;
  textAlign: string;
  listStyleType: string;
  whiteSpace: string;
  visibility: string;
  flexDirection?: 'row' | 'column';
  flexGrow?: number;
  float?: 'left' | 'right' | 'none';
  clear?: 'left' | 'right' | 'both' | 'none';
  width?: number;
  borderStyle?: 'none' | 'solid' | 'dashed' | 'dotted' | 'double';
  borderColor?: string;
  backgroundColor?: string;
  gridTemplateColumns?: string;
  gridGap?: number;
}

export interface StyleResolver {
  getComputedStyle(element: Element): ComputedStyle;
}

const BASE_DEFAULTS: ComputedStyle = {
  display: 'inline',
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
  float: 'none',
  clear: 'none',
  borderStyle: 'none',
  borderColor: '',
  backgroundColor: '',
};

const TAG_DEFAULTS: Record<string, Partial<ComputedStyle>> = {
  h1: { display: 'block', fontWeight: 'bold', marginTop: 1, marginBottom: 0 },
  h2: { display: 'block', fontWeight: 'bold', marginTop: 1, marginBottom: 0 },
  h3: { display: 'block', fontWeight: 'bold', marginTop: 1, marginBottom: 0 },
  h4: { display: 'block', fontWeight: 'bold' },
  h5: { display: 'block', fontWeight: 'bold' },
  h6: { display: 'block', fontWeight: 'bold' },
  p: { display: 'block' },
  div: { display: 'block' },
  span: { display: 'inline' },
  a: { display: 'inline', textDecoration: 'underline' },
  strong: { fontWeight: 'bold' },
  b: { fontWeight: 'bold' },
  em: { display: 'inline' },
  pre: { display: 'block', whiteSpace: 'pre' },
  code: { display: 'inline' },
  ul: { display: 'block', listStyleType: 'disc' },
  ol: { display: 'block', listStyleType: 'decimal' },
  li: { display: 'list-item' },
  table: { display: 'table' },
  thead: { display: 'table-row-group' },
  tbody: { display: 'table-row-group' },
  tfoot: { display: 'table-row-group' },
  tr: { display: 'table-row' },
  td: { display: 'table-cell', paddingLeft: 1 },
  th: { display: 'table-cell', fontWeight: 'bold', paddingLeft: 1 },
  caption: { display: 'table-caption' },
  blockquote: { display: 'block', paddingLeft: 2 },
  nav: { display: 'block' },
  header: { display: 'block' },
  footer: { display: 'block' },
  section: { display: 'block' },
  article: { display: 'block' },
  main: { display: 'block' },
  aside: { display: 'block' },
  figure: { display: 'block' },
  figcaption: { display: 'block' },
  img: { display: 'block' },
  hr: { display: 'block' },
  dl: { display: 'block' },
  dt: { display: 'block' },
  dd: { display: 'block', paddingLeft: 2 },
  address: { display: 'block' },
  details: { display: 'block' },
  summary: { display: 'block' },
  input: { display: 'inline-block', borderStyle: 'solid', paddingLeft: 1 },
  textarea: { display: 'inline-block', borderStyle: 'solid', paddingLeft: 1 },
  select: { display: 'inline-block', borderStyle: 'solid', paddingLeft: 1 },
  button: { display: 'inline-block', borderStyle: 'solid', paddingLeft: 1 },
  label: { display: 'inline' },
  fieldset: { display: 'block', borderStyle: 'solid' },
  legend: { display: 'block', fontWeight: 'bold' },
};

// Class-name heuristics for sites that rely on external stylesheets (which
// aispy does not fetch). Broadly matches MediaWiki / Wikipedia / MDN / common
// "infobox / hatnote / note / warning / sidebar" conventions. Applied *after*
// tag defaults and *before* parsed <style> rules so in-page CSS can override.
const CLASS_DEFAULTS: Record<string, Partial<ComputedStyle>> = {
  // MediaWiki / Wikipedia
  infobox: { float: 'right', width: 32, borderStyle: 'solid', paddingLeft: 1 },
  'infobox-table': { float: 'right', width: 32, borderStyle: 'solid', paddingLeft: 1 },
  hatnote: { backgroundColor: '#fffbe6', paddingLeft: 1 },
  ambox: { backgroundColor: '#fffbe6', borderStyle: 'solid', paddingLeft: 1 },
  wikitable: { borderStyle: 'solid' },
  navbox: { borderStyle: 'solid' },
  // General "aside"-like patterns
  sidebar: { float: 'right', width: 32, borderStyle: 'solid', paddingLeft: 1 },
  // Note/warning conventions (MDN, many docs sites)
  warning: { backgroundColor: '#fff4b8', borderStyle: 'solid', paddingLeft: 1 },
  note: { backgroundColor: '#e6f3ff', borderStyle: 'solid', paddingLeft: 1 },
  notecard: { borderStyle: 'solid', paddingLeft: 1 },
};

function applyClassDefaults(style: ComputedStyle, element: Element): ComputedStyle {
  const className = element.className;
  if (typeof className !== 'string' || className.length === 0) return style;
  let result = style;
  for (const cls of className.split(/\s+/)) {
    const defaults = CLASS_DEFAULTS[cls];
    if (defaults) result = { ...result, ...defaults };
  }
  return result;
}

interface ParsedRule {
  specificity: number;
  match: (el: Element) => boolean;
  declarations: Map<string, string>;
}

function computeSpecificity(selectorParts: csstree.CssNode[]): number {
  let ids = 0;
  let classes = 0;
  let tags = 0;
  for (const part of selectorParts) {
    switch (part.type) {
      case 'IdSelector':
        ids++;
        break;
      case 'ClassSelector':
        classes++;
        break;
      case 'TypeSelector':
        tags++;
        break;
    }
  }
  // Specificity encoded as a single number: ids * 100 + classes * 10 + tags
  return ids * 100 + classes * 10 + tags;
}

function buildMatcher(selectorParts: csstree.CssNode[]): ((el: Element) => boolean) | null {
  const conditions: Array<(el: Element) => boolean> = [];

  for (const part of selectorParts) {
    switch (part.type) {
      case 'TypeSelector':
        conditions.push(
          (el) => el.tagName.toLowerCase() === (part as csstree.TypeSelector).name.toLowerCase(),
        );
        break;
      case 'ClassSelector':
        conditions.push(
          (el) => el.classList.contains((part as csstree.ClassSelector).name),
        );
        break;
      case 'IdSelector':
        conditions.push(
          (el) => el.id === (part as csstree.IdSelector).name,
        );
        break;
      case 'Combinator':
      case 'PseudoClassSelector':
      case 'PseudoElementSelector':
      case 'AttributeSelector':
        // Skip complex selectors entirely
        return null;
      default:
        // Ignore other node types (whitespace, etc.)
        break;
    }
  }

  if (conditions.length === 0) return null;

  return (el: Element) => conditions.every((fn) => fn(el));
}

function extractDeclarations(block: csstree.Block): Map<string, string> {
  const decls = new Map<string, string>();
  for (const node of block.children) {
    if (node.type === 'Declaration') {
      const value = csstree.generate(node.value);
      decls.set(node.property, value);
    }
  }
  return decls;
}

function parseStylesheet(cssText: string): ParsedRule[] {
  const rules: ParsedRule[] = [];

  let ast: csstree.CssNode;
  try {
    ast = csstree.parse(cssText);
  } catch {
    return rules;
  }

  csstree.walk(ast, {
    visit: 'Rule',
    enter(node) {
      const rule = node as csstree.Rule;
      if (rule.prelude.type !== 'SelectorList') return;

      const declarations = extractDeclarations(rule.block);
      if (declarations.size === 0) return;

      for (const selector of rule.prelude.children) {
        if (selector.type !== 'Selector') continue;

        const parts = Array.from(selector.children);
        const match = buildMatcher(parts);
        if (!match) continue;

        const specificity = computeSpecificity(parts);
        rules.push({ specificity, match, declarations });
      }
    },
  });

  return rules;
}

function parseInlineStyle(styleAttr: string): Map<string, string> {
  const decls = new Map<string, string>();

  let ast: csstree.CssNode;
  try {
    ast = csstree.parse(styleAttr, { context: 'declarationList' });
  } catch {
    return decls;
  }

  csstree.walk(ast, {
    visit: 'Declaration',
    enter(node) {
      const decl = node as csstree.Declaration;
      const value = csstree.generate(decl.value);
      decls.set(decl.property, value);
    },
  });

  return decls;
}

const STYLE_PROP_MAP: Record<string, keyof ComputedStyle> = {
  'display': 'display',
  'font-weight': 'fontWeight',
  'color': 'color',
  'text-decoration': 'textDecoration',
  'text-decoration-line': 'textDecoration',
  'margin-top': 'marginTop',
  'margin-bottom': 'marginBottom',
  'padding-left': 'paddingLeft',
  'text-align': 'textAlign',
  'list-style-type': 'listStyleType',
  'white-space': 'whiteSpace',
  'visibility': 'visibility',
  'flex-direction': 'flexDirection',
  'flex-grow': 'flexGrow',
  'float': 'float',
  'clear': 'clear',
  'width': 'width',
  'border-style': 'borderStyle',
  'border-color': 'borderColor',
  'background-color': 'backgroundColor',
  'background': 'backgroundColor',
  'grid-template-columns': 'gridTemplateColumns',
  'grid-gap': 'gridGap',
  'gap': 'gridGap',
};

function parseNumericValue(value: string): number {
  const num = parseFloat(value);
  if (isNaN(num)) return 0;
  // Convert px to approximate terminal columns/rows (assume ~8px per char)
  if (value.endsWith('px')) return Math.round(num / 8);
  if (value.endsWith('em') || value.endsWith('rem')) return Math.round(num);
  return Math.round(num);
}

function applyDeclarations(
  style: ComputedStyle,
  declarations: Map<string, string>,
): ComputedStyle {
  const result = { ...style };

  for (const [prop, value] of declarations) {
    // Handle shorthand 'margin'
    if (prop === 'margin') {
      const parts = value.split(/\s+/);
      if (parts.length === 1) {
        result.marginTop = parseNumericValue(parts[0]!);
        result.marginBottom = parseNumericValue(parts[0]!);
      } else if (parts.length >= 2) {
        result.marginTop = parseNumericValue(parts[0]!);
        result.marginBottom = parseNumericValue(parts[2] ?? parts[0]!);
      }
      continue;
    }

    // Handle shorthand 'border': "1px solid #333"
    if (prop === 'border') {
      const parts = value.split(/\s+/);
      for (const p of parts) {
        if (/^(none|solid|dashed|dotted|double)$/i.test(p)) {
          result.borderStyle = p.toLowerCase() as NonNullable<ComputedStyle['borderStyle']>;
        } else if (p.startsWith('#') || /^[a-z]+$/i.test(p)) {
          result.borderColor = p;
        }
      }
      if (!result.borderStyle || result.borderStyle === 'none') {
        result.borderStyle = 'solid';
      }
      continue;
    }

    // Handle shorthand 'padding'
    if (prop === 'padding') {
      const parts = value.split(/\s+/);
      if (parts.length === 1) {
        result.paddingLeft = parseNumericValue(parts[0]!);
      } else if (parts.length >= 4) {
        result.paddingLeft = parseNumericValue(parts[3]!);
      } else if (parts.length >= 2) {
        result.paddingLeft = parseNumericValue(parts[1]!);
      }
      continue;
    }

    const mapped = STYLE_PROP_MAP[prop];
    if (!mapped) continue;

    if (mapped === 'marginTop' || mapped === 'marginBottom' || mapped === 'paddingLeft') {
      (result[mapped] as number) = parseNumericValue(value);
    } else if (mapped === 'width') {
      result.width = parseNumericValue(value);
    } else if (mapped === 'gridTemplateColumns') {
      result.gridTemplateColumns = value.trim();
    } else if (mapped === 'gridGap') {
      result.gridGap = parseNumericValue(value);
    } else if (mapped === 'flexDirection') {
      const dir = value.trim();
      if (dir === 'row' || dir === 'column') {
        result.flexDirection = dir;
      }
    } else if (mapped === 'flexGrow') {
      const num = parseFloat(value);
      if (!isNaN(num)) {
        result.flexGrow = num;
      }
    } else if (mapped === 'float') {
      const v = value.trim().toLowerCase();
      if (v === 'left' || v === 'right' || v === 'none') {
        result.float = v;
      }
    } else if (mapped === 'clear') {
      const v = value.trim().toLowerCase();
      if (v === 'left' || v === 'right' || v === 'both' || v === 'none') {
        result.clear = v;
      }
    } else {
      (result[mapped] as string) = value;
    }
  }

  return result;
}

export function createStyleResolver(doc: Document): StyleResolver {
  const styleElements = doc.querySelectorAll('style');
  const allRules: ParsedRule[] = [];

  for (const styleEl of styleElements) {
    const cssText = styleEl.textContent ?? '';
    allRules.push(...parseStylesheet(cssText));
  }

  // Sort by specificity (ascending) so higher-specificity rules overwrite lower
  allRules.sort((a, b) => a.specificity - b.specificity);

  const cache = new WeakMap<Element, ComputedStyle>();

  return {
    getComputedStyle(element: Element): ComputedStyle {
      const cached = cache.get(element);
      if (cached) return cached;

      // 1. Start with base defaults
      const tagName = element.tagName.toLowerCase();
      const tagDefaults = TAG_DEFAULTS[tagName];
      let style: ComputedStyle = tagDefaults
        ? { ...BASE_DEFAULTS, ...tagDefaults }
        : { ...BASE_DEFAULTS };

      // 1b. Apply class-name heuristics for sites that rely on external CSS
      style = applyClassDefaults(style, element);

      // 2. Apply stylesheet rules in specificity order
      for (const rule of allRules) {
        if (rule.match(element)) {
          style = applyDeclarations(style, rule.declarations);
        }
      }

      // 3. Apply inline style (highest priority)
      const inlineStyleAttr = element.getAttribute('style');
      if (inlineStyleAttr) {
        const inlineDecls = parseInlineStyle(inlineStyleAttr);
        style = applyDeclarations(style, inlineDecls);
      }

      cache.set(element, style);
      return style;
    },
  };
}
