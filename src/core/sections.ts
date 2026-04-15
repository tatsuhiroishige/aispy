export interface PageSection {
  heading: string;
  level: number;
  startLine: number;
  endLine: number;
  content: string;
}

const HEADING_RE = /^(#{1,6})\s+(.+?)\s*$/;

/**
 * Splits markdown into sections by heading. Each section owns content from
 * its heading line (inclusive) to the next heading of equal-or-shallower
 * level (exclusive).
 */
export function extractSections(markdown: string): PageSection[] {
  const lines = markdown.split('\n');
  const sections: PageSection[] = [];
  const stack: { level: number; heading: string; start: number }[] = [];

  const flushTo = (endLine: number, minLevel: number): void => {
    while (stack.length > 0 && stack[stack.length - 1]!.level >= minLevel) {
      const s = stack.pop()!;
      sections.push({
        heading: s.heading,
        level: s.level,
        startLine: s.start,
        endLine,
        content: lines.slice(s.start, endLine).join('\n'),
      });
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const m = HEADING_RE.exec(lines[i]!);
    if (!m) continue;
    const level = m[1]!.length;
    const heading = m[2]!.trim();
    flushTo(i, level);
    stack.push({ level, heading, start: i });
  }
  flushTo(lines.length, 0);

  sections.sort((a, b) => a.startLine - b.startLine);
  return sections;
}

function normalizeHeading(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim();
}

export function findSection(
  sections: PageSection[],
  query: string,
): PageSection | undefined {
  const q = normalizeHeading(query);
  // Exact match
  for (const s of sections) {
    if (normalizeHeading(s.heading) === q) return s;
  }
  // Starts-with
  for (const s of sections) {
    if (normalizeHeading(s.heading).startsWith(q)) return s;
  }
  // Substring
  for (const s of sections) {
    if (normalizeHeading(s.heading).includes(q)) return s;
  }
  return undefined;
}

export function sectionSummary(sections: PageSection[]): string {
  if (sections.length === 0) return '(no headings)';
  const lines = sections.map(
    (s) => `${'  '.repeat(Math.max(0, s.level - 1))}${'#'.repeat(s.level)} ${s.heading}`,
  );
  return lines.join('\n');
}
