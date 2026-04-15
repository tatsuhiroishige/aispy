import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { createStyleResolver } from './cssResolver.js';
import { buildBoxTree } from './buildBoxTree.js';
import { layout, createLayoutContext, createInitialInput } from './layout.js';
import { paint } from './paint.js';
import { serializeGrid } from './ansiSerializer.js';

function renderHtml(html: string, width = 80): string[] {
  const doc = new JSDOM(html).window.document;
  const root = buildBoxTree(doc, createStyleResolver(doc));
  layout(createLayoutContext(), root, { x: 0, y: 0 }, createInitialInput(width));
  const grid = paint(root);
  return grid.map((line) => line.str);
}

function renderWithAnsi(html: string, width = 80): string {
  const doc = new JSDOM(html).window.document;
  const root = buildBoxTree(doc, createStyleResolver(doc));
  layout(createLayoutContext(), root, { x: 0, y: 0 }, createInitialInput(width));
  return serializeGrid(paint(root));
}

describe('paint + serializer', () => {
  it('renders simple text', () => {
    const lines = renderHtml('<p>hello world</p>', 40);
    const joined = lines.join('\n');
    expect(joined).toContain('hello');
    expect(joined).toContain('world');
  });

  it('wraps long text to multiple lines', () => {
    const lines = renderHtml('<p>one two three four five six seven eight</p>', 10);
    expect(lines.length).toBeGreaterThan(1);
  });

  it('stacks multiple paragraphs vertically', () => {
    const lines = renderHtml('<div><p>first</p><p>second</p></div>', 40);
    const firstIdx = lines.findIndex((l) => l.includes('first'));
    const secondIdx = lines.findIndex((l) => l.includes('second'));
    expect(firstIdx).toBeGreaterThanOrEqual(0);
    expect(secondIdx).toBeGreaterThan(firstIdx);
  });

  it('preserves list markers', () => {
    const lines = renderHtml('<ul><li>apple</li><li>banana</li></ul>', 40);
    const joined = lines.join('\n');
    expect(joined).toContain('•');
    expect(joined).toContain('apple');
  });

  it('decimal markers on ol', () => {
    const lines = renderHtml('<ol><li>a</li><li>b</li><li>c</li></ol>', 40);
    const joined = lines.join('\n');
    expect(joined).toContain('1.');
    expect(joined).toContain('2.');
    expect(joined).toContain('3.');
  });

  it('emits ANSI bold for <strong>', () => {
    const out = renderWithAnsi('<p>regular <strong>BOLD</strong></p>', 40);
    expect(out).toContain('\x1b[');
    expect(out.includes(';1;') || out.includes('[1;') || out.includes(';1m')).toBe(true);
  });

  it('emits ANSI underline for <a>', () => {
    const out = renderWithAnsi('<p><a href="x">link</a></p>', 40);
    expect(out.includes(';4;') || out.includes('[4;') || out.includes(';4m')).toBe(true);
  });

  it('resets format at end of formatted span', () => {
    const out = renderWithAnsi('<p><strong>x</strong>y</p>', 40);
    expect(out).toContain('\x1b[0m');
  });

  it('handles CJK text', () => {
    const lines = renderHtml('<p>こんにちは世界</p>', 40);
    const joined = lines.join('\n');
    expect(joined).toContain('こんにちは');
  });

  it('skips script and style content', () => {
    const lines = renderHtml('<p>visible</p><script>hidden</script><style>.x{}</style>', 40);
    const joined = lines.join('\n');
    expect(joined).toContain('visible');
    expect(joined).not.toContain('hidden');
    expect(joined).not.toContain('.x{');
  });

  it('underlines h1 with ═', () => {
    const lines = renderHtml('<h1>Title</h1><p>body</p>', 40);
    const joined = lines.join('\n');
    expect(joined).toContain('Title');
    expect(joined).toContain('═');
  });

  it('underlines h2 with ─', () => {
    const lines = renderHtml('<h2>Section</h2><p>body</p>', 40);
    const joined = lines.join('\n');
    expect(joined).toContain('Section');
    expect(joined).toContain('─');
  });

  it('does not underline h3+', () => {
    const lines = renderHtml('<h3>Subsection</h3>', 40);
    const joined = lines.join('\n');
    expect(joined).toContain('Subsection');
    expect(joined).not.toContain('═');
    expect(joined).not.toContain('─');
  });

  it('separates paragraphs with blank line (margin-bottom)', () => {
    const lines = renderHtml('<p>first</p><p>second</p>', 40);
    const firstIdx = lines.findIndex((l) => l.includes('first'));
    const secondIdx = lines.findIndex((l) => l.includes('second'));
    expect(secondIdx).toBeGreaterThan(firstIdx + 1);
  });

  it('appends Sources section with numbered links', () => {
    const lines = renderHtml(
      '<p>See <a href="https://a.example">site A</a> and <a href="https://b.example">site B</a></p>',
      80,
    );
    const joined = lines.join('\n');
    expect(joined).toContain('Sources');
    expect(joined).toContain('[1] https://a.example');
    expect(joined).toContain('[2] https://b.example');
  });

  it('skips anchor/javascript/mailto hrefs in Sources', () => {
    const lines = renderHtml(
      '<p><a href="#top">top</a> <a href="javascript:void(0)">js</a> <a href="mailto:x@y.com">mail</a></p>',
      80,
    );
    const joined = lines.join('\n');
    expect(joined).not.toContain('── Sources ──');
  });

  it('deduplicates duplicate hrefs in Sources', () => {
    const lines = renderHtml(
      '<p><a href="https://ex.com/a">one</a> <a href="https://ex.com/a">two</a></p>',
      80,
    );
    const joined = lines.join('\n');
    expect(joined).toContain('[1] https://ex.com/a');
    expect(joined).not.toContain('[2]');
  });
});
