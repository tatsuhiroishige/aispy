import { describe, it, expect } from 'vitest';
import { extractLinks, findByLabel, prefixMatches, _internal } from './linkHints.js';

describe('labelForIndex', () => {
  it('generates single-letter labels for small indices', () => {
    expect(_internal.labelForIndex(0)).toBe(_internal.LABEL_ALPHABET[0]);
    expect(_internal.labelForIndex(1)).toBe(_internal.LABEL_ALPHABET[1]);
  });

  it('generates two-letter labels beyond alphabet length', () => {
    const n = _internal.LABEL_ALPHABET.length;
    const label = _internal.labelForIndex(n);
    expect(label.length).toBe(2);
  });
});

describe('extractLinks', () => {
  it('extracts unique navigable links from HTML', async () => {
    const html = `
      <body>
        <a href="https://a.com">Alpha</a>
        <a href="/rel">Rel</a>
        <a href="#frag">Frag</a>
        <a href="mailto:x@y.z">Mail</a>
        <a href="https://a.com">Dup</a>
      </body>
    `;
    const links = await extractLinks(html, 'https://base.test/page');
    const urls = links.map((l) => l.url);
    expect(urls).toContain('https://a.com/');
    expect(urls).toContain('https://base.test/rel');
    expect(urls).not.toContain('#frag');
    expect(urls.filter((u) => u === 'https://a.com/')).toHaveLength(1);
  });

  it('assigns sequential labels', async () => {
    const html = `<a href="https://1.com">1</a><a href="https://2.com">2</a>`;
    const links = await extractLinks(html, 'https://x');
    expect(links[0]?.label).toBe(_internal.LABEL_ALPHABET[0]);
    expect(links[1]?.label).toBe(_internal.LABEL_ALPHABET[1]);
  });

  it('uses inner text and trims', async () => {
    const html = `<a href="https://a.com">  Hello  world  </a>`;
    const links = await extractLinks(html, 'https://x');
    expect(links[0]?.text).toBe('Hello world');
  });
});

describe('findByLabel / prefixMatches', () => {
  const hints = [
    { label: 'a', text: '1', url: '1' },
    { label: 'as', text: '2', url: '2' },
    { label: 'd', text: '3', url: '3' },
  ];
  it('findByLabel returns exact match', () => {
    expect(findByLabel(hints, 'a')?.url).toBe('1');
    expect(findByLabel(hints, 'as')?.url).toBe('2');
    expect(findByLabel(hints, 'z')).toBeUndefined();
  });
  it('prefixMatches filters by prefix', () => {
    expect(prefixMatches(hints, 'a').map((h) => h.url)).toEqual(['1', '2']);
    expect(prefixMatches(hints, 'as').map((h) => h.url)).toEqual(['2']);
    expect(prefixMatches(hints, '').length).toBe(3);
  });
});
