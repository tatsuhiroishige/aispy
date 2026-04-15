import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { createStyleResolver } from './cssResolver.js';
import { buildBoxTree } from './buildBoxTree.js';
import { layout, createLayoutContext, createInitialInput, getLayoutState } from './layout.js';
import { paint } from './paint.js';
import { serializeGrid } from './ansiSerializer.js';

function render(html: string, width = 80): string[] {
  const doc = new JSDOM(html).window.document;
  const root = buildBoxTree(doc, createStyleResolver(doc));
  layout(createLayoutContext(), root, { x: 0, y: 0 }, createInitialInput(width));
  const grid = paint(root);
  return serializeGrid(grid).split('\n');
}

function layoutHtml(html: string, width = 80) {
  const doc = new JSDOM(html).window.document;
  const root = buildBoxTree(doc, createStyleResolver(doc));
  layout(createLayoutContext(), root, { x: 0, y: 0 }, createInitialInput(width));
  return root;
}

describe('Table layout', () => {
  it('renders a 2x2 table side by side', () => {
    const lines = render(
      '<table><tr><td>AA</td><td>BB</td></tr><tr><td>CC</td><td>DD</td></tr></table>',
      40,
    );
    const joined = lines.join('\n');
    expect(joined).toContain('AA');
    expect(joined).toContain('BB');
    expect(joined).toContain('CC');
    expect(joined).toContain('DD');
    // First row should have AA and BB on the same line
    const rowLine = lines.find((l) => l.includes('AA'));
    expect(rowLine).toContain('BB');
  });

  it('handles implicit tbody', () => {
    const lines = render('<table><tr><td>x</td><td>y</td></tr></table>', 40);
    const rowLine = lines.find((l) => l.includes('x'));
    expect(rowLine).toContain('y');
  });

  it('handles explicit tbody', () => {
    const lines = render(
      '<table><tbody><tr><td>x</td><td>y</td></tr></tbody></table>',
      40,
    );
    const rowLine = lines.find((l) => l.includes('x'));
    expect(rowLine).toContain('y');
  });

  it('th cells are bold', () => {
    const doc = new JSDOM(
      '<table><tr><th>Header</th></tr><tr><td>body</td></tr></table>',
    ).window.document;
    const root = buildBoxTree(doc, createStyleResolver(doc));
    layout(createLayoutContext(), root, { x: 0, y: 0 }, createInitialInput(40));
    const grid = paint(root);
    const out = serializeGrid(grid);
    // Header line should contain ANSI bold (flag 1)
    const headerLine = out.split('\n').find((l) => l.includes('Header'));
    expect(headerLine).toBeDefined();
    expect(headerLine!.includes(';1;') || headerLine!.includes('[1;') || headerLine!.includes(';1m')).toBe(true);
  });

  it('divides columns based on max cell count', () => {
    const root = layoutHtml(
      '<table><tr><td>A</td><td>B</td><td>C</td></tr><tr><td>D</td></tr></table>',
      60,
    );
    // Find the first tr's td cells and check their x positions differ
    let tdCount = 0;
    const xs: number[] = [];
    function visit(box: typeof root): void {
      if (box.kind === 'block' && box.computed.display === 'table-cell') {
        const s = getLayoutState(box);
        if (s) {
          xs.push(s.offset.x);
          tdCount++;
        }
      }
      for (const c of box.children) visit(c as typeof root);
    }
    visit(root);
    expect(tdCount).toBeGreaterThanOrEqual(3);
    // First row's cells should have distinct x
    expect(new Set(xs.slice(0, 3)).size).toBe(3);
  });
});
