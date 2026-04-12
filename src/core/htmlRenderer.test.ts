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

  it('renders basic tables with separators', () => {
    const out = render(`
      <table>
        <thead><tr><th>Name</th><th>Age</th></tr></thead>
        <tbody>
          <tr><td>Alice</td><td>30</td></tr>
          <tr><td>Bob</td><td>25</td></tr>
        </tbody>
      </table>
    `);
    expect(out).toContain('\u2502'); // cell separator
    expect(out).toContain('\u2500'); // header underline
    expect(out).toContain('\u253C'); // cross
    expect(out).toContain('Alice');
    expect(out).toContain('Bob');
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
});
