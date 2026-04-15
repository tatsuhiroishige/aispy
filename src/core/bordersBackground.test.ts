import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { createStyleResolver } from './cssResolver.js';
import { buildBoxTree } from './buildBoxTree.js';
import { layout, createLayoutContext, createInitialInput } from './layout.js';
import { paint } from './paint.js';
import { serializeGrid } from './ansiSerializer.js';

function renderString(html: string, width = 40): string {
  const doc = new JSDOM(html).window.document;
  const root = buildBoxTree(doc, createStyleResolver(doc));
  const ctx = createLayoutContext(1, 1, 10, 20);
  layout(ctx, root, { x: 0, y: 0 }, createInitialInput(width));
  const grid = paint(root, 'none');
  return serializeGrid(grid);
}

describe('Border rendering', () => {
  it('draws solid border box', () => {
    const out = renderString(
      '<div style="border: solid; width: 20"><p>hello</p></div>',
      40,
    );
    expect(out).toContain('┌');
    expect(out).toContain('┐');
    expect(out).toContain('└');
    expect(out).toContain('┘');
    expect(out).toContain('─');
    expect(out).toContain('│');
  });

  it('draws double border', () => {
    const out = renderString(
      '<div style="border-style: double; width: 20"><p>x</p></div>',
      40,
    );
    expect(out).toContain('╔');
    expect(out).toContain('═');
    expect(out).toContain('║');
  });

  it('no border when border-style: none', () => {
    const out = renderString('<div><p>no border</p></div>', 40);
    expect(out).not.toContain('┌');
    expect(out).not.toContain('╔');
  });
});

describe('Background color', () => {
  it('emits bg escape for background-color (8-color for named color)', () => {
    const out = renderString(
      '<div style="background-color: red; width: 20"><p>x</p></div>',
      40,
    );
    // "red" → named color index 1 → bg 41 in 8-color form
    // eslint-disable-next-line no-control-regex
    expect(out).toMatch(/\u001b\[[^m]*;41m/);
  });

  it('emits 256-color bg escape for hex', () => {
    const out = renderString(
      '<div style="background-color: #88ff88; width: 20"><p>x</p></div>',
      40,
    );
    // eslint-disable-next-line no-control-regex
    expect(out).toMatch(/\u001b\[[^m]*48;5;/);
  });

  it('omits bg escape when no background-color', () => {
    const out = renderString('<div><p>x</p></div>', 40);
    // eslint-disable-next-line no-control-regex
    expect(out).not.toMatch(/\u001b\[[^m]*(?:48;5;|;4[0-7]m|;10[0-7]m)/);
  });
});
