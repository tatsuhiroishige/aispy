import { describe, it, expect } from 'vitest';
import { htmlToText } from './htmlToText.js';

describe('htmlToText', () => {
  it('converts <h1> to an atx heading', () => {
    const out = htmlToText('<h1>Hello</h1>');
    expect(out).toContain('# Hello');
  });

  it('strips <script> content', () => {
    const out = htmlToText('<script>alert(1)</script><p>body</p>');
    expect(out).toContain('body');
    expect(out).not.toContain('alert(1)');
  });

  it('strips <style> content', () => {
    const out = htmlToText('<style>.a{color:red}</style><p>body</p>');
    expect(out).toContain('body');
    expect(out).not.toContain('color:red');
  });

  it('converts <ul><li> to dash bullets', () => {
    const out = htmlToText('<ul><li>a</li><li>b</li></ul>');
    expect(out).toMatch(/^-\s+a$/m);
    expect(out).toMatch(/^-\s+b$/m);
  });

  it('converts <pre><code> to a fenced code block', () => {
    const out = htmlToText('<pre><code>x = 1</code></pre>');
    expect(out).toContain('```');
    expect(out).toContain('x = 1');
  });
});
