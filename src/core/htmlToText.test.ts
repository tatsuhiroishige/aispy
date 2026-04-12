import { describe, it, expect } from 'vitest';
import { htmlToText } from './htmlToText.js';

describe('htmlToText', () => {
  it('converts <h1> to an atx heading', async () => {
    const out = await htmlToText('<h1>Hello</h1>');
    expect(out).toContain('# Hello');
  });

  it('strips <script> content', async () => {
    const out = await htmlToText('<script>alert(1)</script><p>body</p>');
    expect(out).toContain('body');
    expect(out).not.toContain('alert(1)');
  });

  it('strips <style> content', async () => {
    const out = await htmlToText('<style>.a{color:red}</style><p>body</p>');
    expect(out).toContain('body');
    expect(out).not.toContain('color:red');
  });

  it('converts <ul><li> to dash bullets', async () => {
    const out = await htmlToText('<ul><li>a</li><li>b</li></ul>');
    expect(out).toMatch(/^-\s+a$/m);
    expect(out).toMatch(/^-\s+b$/m);
  });

  it('converts <pre><code> to a fenced code block', async () => {
    const out = await htmlToText('<pre><code>x = 1</code></pre>');
    expect(out).toContain('```');
    expect(out).toContain('x = 1');
  });

  it('extracts article content and strips nav/footer', async () => {
    const html = `
      <!DOCTYPE html>
      <html><head><title>Test</title></head><body>
        <nav><a href="/">Home</a><a href="/about">About</a></nav>
        <article>
          <h1>Main Article</h1>
          <p>This is the important article content that should be extracted by Readability.</p>
          <p>It contains multiple paragraphs to ensure Readability considers it substantial enough.</p>
          <p>A third paragraph helps make the content long enough for extraction.</p>
        </article>
        <footer><p>Footer info copyright 2024</p></footer>
      </body></html>
    `;
    const out = await htmlToText(html);
    expect(out).toContain('Main Article');
    expect(out).toContain('important article content');
    expect(out).not.toContain('Footer info');
  });

  it('falls back on non-article HTML', async () => {
    const out = await htmlToText('<p>Hello</p>');
    expect(out).toContain('Hello');
  });

  it('resolves relative URLs when url is provided', async () => {
    const html = `
      <!DOCTYPE html>
      <html><head><title>Links</title></head><body>
        <article>
          <p>Read the <a href="/relative">link</a> for more details.</p>
          <p>This article has enough content for Readability to parse it properly.</p>
          <p>We need several paragraphs to ensure the article extraction works.</p>
        </article>
      </body></html>
    `;
    const out = await htmlToText(html, 'https://example.com');
    expect(out).toContain('[link](https://example.com/relative)');
  });
});
