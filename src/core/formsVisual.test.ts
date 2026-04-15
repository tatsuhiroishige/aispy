import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { createStyleResolver } from './cssResolver.js';
import { buildBoxTree } from './buildBoxTree.js';
import { layout, createLayoutContext, createInitialInput } from './layout.js';
import { paint } from './paint.js';
import { serializeGrid } from './ansiSerializer.js';

function renderString(html: string, width = 60): string {
  const doc = new JSDOM(html).window.document;
  const root = buildBoxTree(doc, createStyleResolver(doc));
  const ctx = createLayoutContext(1, 1, 10, 20);
  layout(ctx, root, { x: 0, y: 0 }, createInitialInput(width));
  const grid = paint(root, 'none');
  return serializeGrid(grid);
}

describe('Form visual rendering', () => {
  it('text input shows value inside border', () => {
    const out = renderString(
      '<form><input type="text" value="hello"></form>',
      60,
    );
    expect(out).toContain('┌');
    expect(out).toContain('hello');
  });

  it('text input with placeholder when empty', () => {
    const out = renderString(
      '<form><input type="text" placeholder="Search"></form>',
      60,
    );
    expect(out).toContain('Search');
  });

  it('password shows bullets, not the value', () => {
    const out = renderString(
      '<form><input type="password" value="secret"></form>',
      60,
    );
    expect(out).toContain('••••••');
    expect(out).not.toContain('secret');
  });

  it('checkbox shows [ ] or [x]', () => {
    const off = renderString('<form><input type="checkbox"></form>', 20);
    expect(off).toContain('[ ]');
    const on = renderString('<form><input type="checkbox" checked></form>', 20);
    expect(on).toContain('[x]');
  });

  it('radio shows ( ) or (●)', () => {
    const off = renderString('<form><input type="radio"></form>', 20);
    expect(off).toContain('( )');
    const on = renderString('<form><input type="radio" checked></form>', 20);
    expect(on).toContain('(●)');
  });

  it('button renders label inside border', () => {
    const out = renderString('<form><button>Click me</button></form>', 60);
    expect(out).toContain('┌');
    expect(out).toContain('Click me');
  });

  it('submit input renders its value as label', () => {
    const out = renderString(
      '<form><input type="submit" value="Send"></form>',
      60,
    );
    expect(out).toContain('Send');
  });

  it('select shows selected option with dropdown chevron', () => {
    const out = renderString(
      '<form><select><option>A</option><option selected>B</option></select></form>',
      40,
    );
    expect(out).toContain('B');
    expect(out).toContain('▾');
  });

  it('textarea shows its content with border', () => {
    const out = renderString(
      '<form><textarea>draft text</textarea></form>',
      60,
    );
    expect(out).toContain('┌');
    expect(out).toContain('draft text');
  });

  it('hidden input does not render', () => {
    const out = renderString(
      '<form><input type="hidden" name="csrf" value="xyz"><p>after</p></form>',
      40,
    );
    expect(out).not.toContain('xyz');
    expect(out).toContain('after');
  });
});
