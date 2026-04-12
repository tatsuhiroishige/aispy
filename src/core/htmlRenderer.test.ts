import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { renderHtmlToTerminal } from './htmlRenderer.js';

function render(html: string, width = 80): string {
  const dom = new JSDOM(`<body>${html}</body>`);
  return renderHtmlToTerminal(dom.window.document, width);
}

describe('renderHtmlToTerminal', () => {
  it('renders <h1> through <h6> with hash prefixes', () => {
    const out = render('<h1>Title</h1><h2>Sub</h2><h3>Section</h3>');
    expect(out).toContain('# Title');
    expect(out).toContain('## Sub');
    expect(out).toContain('### Section');
  });

  it('word-wraps paragraphs at the specified width', () => {
    const long = 'word '.repeat(30).trim(); // 149 chars
    const out = render(`<p>${long}</p>`, 40);
    const lines = out.split('\n');
    for (const line of lines) {
      expect(line.length).toBeLessThanOrEqual(40);
    }
    // All words should still be present
    expect(out.replace(/\n/g, ' ')).toContain('word word word');
  });

  it('renders <blockquote> with box-drawing prefix', () => {
    const out = render('<blockquote><p>Quote text</p></blockquote>');
    expect(out).toMatch(/\u2502 .*Quote text/);
  });

  it('renders nested blockquotes with double prefix', () => {
    const out = render(
      '<blockquote><blockquote><p>Deep quote</p></blockquote></blockquote>'
    );
    // Should have two │ prefixes
    const lines = out.split('\n').filter(l => l.includes('Deep quote'));
    expect(lines.length).toBeGreaterThan(0);
    expect(lines[0]).toMatch(/\u2502 .*\u2502 .*Deep quote/);
  });

  it('renders unordered lists with dash bullets', () => {
    const out = render('<ul><li>Alpha</li><li>Beta</li><li>Gamma</li></ul>');
    expect(out).toContain('- Alpha');
    expect(out).toContain('- Beta');
    expect(out).toContain('- Gamma');
  });

  it('renders ordered lists with numbers', () => {
    const out = render('<ol><li>First</li><li>Second</li><li>Third</li></ol>');
    expect(out).toContain('1. First');
    expect(out).toContain('2. Second');
    expect(out).toContain('3. Third');
  });

  it('renders nested lists with increased indent', () => {
    const out = render(
      '<ul><li>Parent<ul><li>Child</li></ul></li></ul>'
    );
    const parentLine = out.split('\n').find(l => l.includes('Parent'));
    const childLine = out.split('\n').find(l => l.includes('Child'));
    expect(parentLine).toBeDefined();
    expect(childLine).toBeDefined();
    // Child should have more leading whitespace than parent
    const parentIndent = parentLine!.match(/^\s*/)![0].length;
    const childIndent = childLine!.match(/^\s*/)![0].length;
    expect(childIndent).toBeGreaterThan(parentIndent);
  });

  it('preserves whitespace in <pre><code> blocks', () => {
    const code = '  x = 1\n  y = 2\n  if x:\n    print(y)';
    const out = render(`<pre><code>${code}</code></pre>`);
    expect(out).toContain('x = 1');
    expect(out).toContain('  if x:');
    expect(out).toContain('    print(y)');
  });

  it('renders links as text (url)', () => {
    const out = render('<p>Visit <a href="https://example.com">Example</a> now</p>');
    expect(out).toContain('Example (https://example.com)');
  });

  it('renders basic tables with box-drawing borders', () => {
    const out = render(`
      <table>
        <thead><tr><th>Name</th><th>Age</th></tr></thead>
        <tbody>
          <tr><td>Alice</td><td>30</td></tr>
          <tr><td>Bob</td><td>25</td></tr>
        </tbody>
      </table>
    `);
    const lines = out.split('\n');
    // Top border: ┌──┬──┐
    expect(lines[0]).toMatch(/\u250C\u2500+\u252C\u2500+\u2510/);
    // Header row with │
    expect(lines[1]).toMatch(/\u2502.*Name.*\u2502.*Age.*\u2502/);
    // Header separator: ├──┼──┤
    expect(lines[2]).toMatch(/\u251C\u2500+\u253C\u2500+\u2524/);
    // Data rows
    expect(lines[3]).toMatch(/\u2502.*Alice.*\u2502/);
    expect(lines[4]).toMatch(/\u2502.*Bob.*\u2502/);
    // Bottom border: └──┴──┘
    expect(lines[5]).toMatch(/\u2514\u2500+\u2534\u2500+\u2518/);
  });

  it('renders table with <thead>/<th> with header separator', () => {
    const out = render(`
      <table>
        <thead><tr><th>Col A</th><th>Col B</th></tr></thead>
        <tbody><tr><td>x</td><td>y</td></tr></tbody>
      </table>
    `);
    // Should have ├ and ┤ for header separator
    expect(out).toContain('\u251C');
    expect(out).toContain('\u2524');
    expect(out).toContain('\u253C');
  });

  it('treats first row as header when no explicit thead/th', () => {
    const out = render(`
      <table>
        <tr><td>Header1</td><td>Header2</td></tr>
        <tr><td>val1</td><td>val2</td></tr>
      </table>
    `);
    const lines = out.split('\n');
    // Should still have header separator after first row
    expect(lines[2]).toMatch(/\u251C\u2500+\u253C\u2500+\u2524/);
  });

  it('adjusts column widths to content', () => {
    const out = render(`
      <table>
        <tr><th>N</th><th>LongerColumn</th></tr>
        <tr><td>a</td><td>b</td></tr>
      </table>
    `);
    const lines = out.split('\n');
    // The top border segments should have different lengths
    const topBorder = lines[0]!;
    const segments = topBorder.split(/[\u250C\u252C\u2510]/).filter(Boolean);
    // "LongerColumn" column should be wider than "N" column
    // Both get minimum 5 or their content width
    expect(segments.length).toBe(2);
    expect(segments[1]!.length).toBeGreaterThanOrEqual(segments[0]!.length);
  });

  it('truncates long cell content at column width', () => {
    const longText = 'a'.repeat(100);
    const out = render(`
      <table>
        <tr><th>Short</th><th>Data</th></tr>
        <tr><td>${longText}</td><td>ok</td></tr>
      </table>
    `, 40);
    // The long text should be truncated with ellipsis
    expect(out).toContain('\u2026');
    // Each line should not exceed width
    for (const line of out.split('\n')) {
      expect(line.length).toBeLessThanOrEqual(40);
    }
  });

  it('table with many columns fits within terminal width', () => {
    const out = render(`
      <table>
        <tr><th>A</th><th>B</th><th>C</th><th>D</th><th>E</th></tr>
        <tr><td>1</td><td>2</td><td>3</td><td>4</td><td>5</td></tr>
      </table>
    `, 60);
    for (const line of out.split('\n')) {
      expect(line.length).toBeLessThanOrEqual(60);
    }
    // Should still have all 5 columns (6 │ chars per data row)
    const dataLine = out.split('\n').find(l => l.includes('1') && l.includes('5'));
    expect(dataLine).toBeDefined();
    const pipeCount = (dataLine!.match(/\u2502/g) ?? []).length;
    expect(pipeCount).toBe(6); // left + 4 inner + right
  });

  it('renders mixed content in correct order', () => {
    const out = render(`
      <h1>Title</h1>
      <p>Intro paragraph.</p>
      <ul><li>Item A</li><li>Item B</li></ul>
    `);
    const titleIdx = out.indexOf('# Title');
    const introIdx = out.indexOf('Intro paragraph');
    const itemIdx = out.indexOf('- Item A');
    expect(titleIdx).toBeLessThan(introIdx);
    expect(introIdx).toBeLessThan(itemIdx);
  });

  it('strips script and style content', () => {
    const out = render(
      '<script>alert("xss")</script><style>.a{color:red}</style><p>Clean content</p>'
    );
    expect(out).toContain('Clean content');
    expect(out).not.toContain('alert');
    expect(out).not.toContain('color:red');
  });

  it('renders <hr> as box-drawing line', () => {
    const out = render('<p>Above</p><hr><p>Below</p>');
    expect(out).toContain('\u2500'.repeat(5));
    const aboveIdx = out.indexOf('Above');
    const belowIdx = out.indexOf('Below');
    expect(aboveIdx).toBeLessThan(belowIdx);
  });

  it('renders inline <code> with backticks', () => {
    const out = render('<p>Use <code>npm install</code> to install</p>');
    expect(out).toContain('`npm install`');
  });

  it('renders <img> with alt text', () => {
    const out = render('<p>See <img alt="diagram of flow"> here</p>');
    expect(out).toContain('[image: diagram of flow]');
  });

  it('skips <img> without alt text', () => {
    const out = render('<p>Before<img src="x.png">After</p>');
    expect(out).toContain('Before');
    expect(out).toContain('After');
    expect(out).not.toContain('[image');
  });

  it('handles empty document gracefully', () => {
    const out = render('');
    expect(out).toBe('');
  });

  it('strips nav and footer elements', () => {
    const out = render(
      '<nav><a href="/">Home</a></nav><p>Content</p><footer>Copyright</footer>'
    );
    expect(out).toContain('Content');
    expect(out).not.toContain('Home');
    expect(out).not.toContain('Copyright');
  });

  it('hides elements with CSS display:none via <style> block', () => {
    const out = render(
      '<style>.cookie-banner { display: none }</style>' +
      '<div class="cookie-banner">Accept cookies?</div>' +
      '<p>Visible content</p>'
    );
    expect(out).toContain('Visible content');
    expect(out).not.toContain('cookie');
  });

  it('hides elements with inline style display:none', () => {
    const out = render(
      '<div style="display:none">Hidden sidebar</div>' +
      '<p>Main content</p>'
    );
    expect(out).toContain('Main content');
    expect(out).not.toContain('Hidden sidebar');
  });

  it('hides elements with CSS visibility:hidden', () => {
    const out = render(
      '<style>.invisible { visibility: hidden }</style>' +
      '<p class="invisible">Ghost text</p>' +
      '<p>Real text</p>'
    );
    expect(out).toContain('Real text');
    expect(out).not.toContain('Ghost text');
  });

  it('hides inline elements with display:none inside paragraphs', () => {
    const out = render(
      '<style>.ad { display: none }</style>' +
      '<p>Before <span class="ad">Buy now!</span> After</p>'
    );
    expect(out).toContain('Before');
    expect(out).toContain('After');
    expect(out).not.toContain('Buy now');
  });

  it('renders flex row with children side by side', () => {
    const out = render(
      '<div style="display:flex"><div>A</div><div>B</div></div>',
      80
    );
    // Both A and B should appear on the same line
    const lines = out.split('\n').filter(l => l.trim());
    const lineWithA = lines.find(l => l.includes('A'));
    expect(lineWithA).toBeDefined();
    expect(lineWithA).toContain('B');
  });

  it('renders flex column with children stacked vertically', () => {
    const out = render(
      '<div style="display:flex;flex-direction:column"><div>A</div><div>B</div></div>',
      80
    );
    const lines = out.split('\n').filter(l => l.trim());
    const aLine = lines.findIndex(l => l.includes('A'));
    const bLine = lines.findIndex(l => l.includes('B'));
    expect(aLine).toBeGreaterThanOrEqual(0);
    expect(bLine).toBeGreaterThan(aLine);
  });

  it('renders flex-grow to distribute extra width', () => {
    const out = render(
      '<div style="display:flex">' +
      '<div style="flex-grow:1">Wide</div>' +
      '<div>Fixed</div>' +
      '</div>',
      60
    );
    // Both should appear on the same line
    const lines = out.split('\n').filter(l => l.trim());
    const lineWithBoth = lines.find(l => l.includes('Wide') && l.includes('Fixed'));
    expect(lineWithBoth).toBeDefined();
    // "Wide" should have more space before "Fixed" since it has flex-grow:1
    const wideIdx = lineWithBoth!.indexOf('Wide');
    const fixedIdx = lineWithBoth!.indexOf('Fixed');
    expect(fixedIdx).toBeGreaterThan(wideIdx + 'Wide'.length);
  });

  it('renders flex via CSS class', () => {
    const out = render(
      '<style>.row{display:flex}</style>' +
      '<div class="row"><div>X</div><div>Y</div></div>',
      80
    );
    // X and Y should appear on the same line
    const lines = out.split('\n').filter(l => l.trim());
    const lineWithX = lines.find(l => l.includes('X'));
    expect(lineWithX).toBeDefined();
    expect(lineWithX).toContain('Y');
  });
});
