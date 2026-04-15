import { describe, it, expect } from 'vitest';
import { extractSections, findSection, sectionSummary } from './sections.js';

describe('extractSections', () => {
  it('returns empty for markdown without headings', () => {
    expect(extractSections('plain text')).toEqual([]);
  });

  it('extracts h1 sections', () => {
    const md = '# A\nbody a\n# B\nbody b';
    const s = extractSections(md);
    expect(s.map((x) => x.heading)).toEqual(['A', 'B']);
    expect(s[0]!.content).toContain('body a');
    expect(s[1]!.content).toContain('body b');
    expect(s[0]!.content).not.toContain('body b');
  });

  it('nested headings: h2 inside h1 is its own section', () => {
    const md = '# Top\nintro\n## Sub\ndetail\n# Next\nother';
    const s = extractSections(md);
    const top = s.find((x) => x.heading === 'Top')!;
    const sub = s.find((x) => x.heading === 'Sub')!;
    const next = s.find((x) => x.heading === 'Next')!;
    expect(top.content).toContain('intro');
    expect(top.content).toContain('detail');
    expect(top.content).not.toContain('other');
    expect(sub.content).toContain('detail');
    expect(sub.content).not.toContain('intro');
    expect(next.content).toContain('other');
  });

  it('deeper levels only close to equal-or-shallower', () => {
    const md = '# A\n## A1\n### A1a\n# B';
    const s = extractSections(md);
    expect(s.find((x) => x.heading === 'A1a')).toBeDefined();
    expect(s.find((x) => x.heading === 'A')!.content).toContain('A1a');
  });
});

describe('findSection', () => {
  const md = '# Introduction\nHello\n## Geography\nLand\n## History\nPast';
  const sections = extractSections(md);

  it('finds by exact heading (case-insensitive)', () => {
    expect(findSection(sections, 'geography')?.heading).toBe('Geography');
  });

  it('finds by starts-with', () => {
    expect(findSection(sections, 'His')?.heading).toBe('History');
  });

  it('finds by substring', () => {
    expect(findSection(sections, 'intro')?.heading).toBe('Introduction');
  });

  it('returns undefined when no match', () => {
    expect(findSection(sections, 'zzz')).toBeUndefined();
  });
});

describe('sectionSummary', () => {
  it('formats headings with indentation by level', () => {
    const md = '# A\n## A1\n### A1a\n# B';
    const out = sectionSummary(extractSections(md));
    expect(out).toContain('# A');
    expect(out).toContain('  ## A1');
    expect(out).toContain('    ### A1a');
    expect(out).toContain('# B');
  });

  it('returns marker when no headings', () => {
    expect(sectionSummary([])).toBe('(no headings)');
  });
});
