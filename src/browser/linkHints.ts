export interface LinkHint {
  label: string;
  text: string;
  url: string;
}

const LABEL_ALPHABET = 'asdfghjklqwertyuiopzxcvbnm';

function labelForIndex(index: number): string {
  const base = LABEL_ALPHABET.length;
  if (index < base) return LABEL_ALPHABET[index]!;
  const hi = Math.floor(index / base) - 1;
  const lo = index % base;
  return LABEL_ALPHABET[hi]! + LABEL_ALPHABET[lo]!;
}

function isNavigableHref(href: string): boolean {
  if (!href) return false;
  if (href.startsWith('#')) return false;
  if (href.startsWith('javascript:')) return false;
  if (href.startsWith('mailto:')) return false;
  if (href.startsWith('tel:')) return false;
  return true;
}

function resolveUrl(href: string, baseUrl: string): string | null {
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return null;
  }
}

export async function extractLinks(html: string, baseUrl: string): Promise<LinkHint[]> {
  const { JSDOM } = await import('jsdom');
  const dom = new JSDOM(html, { url: baseUrl });
  const anchors = Array.from(dom.window.document.querySelectorAll('a[href]')) as HTMLAnchorElement[];
  const seen = new Set<string>();
  const hints: LinkHint[] = [];

  for (const a of anchors) {
    const raw = a.getAttribute('href') ?? '';
    if (!isNavigableHref(raw)) continue;
    const resolved = resolveUrl(raw, baseUrl);
    if (!resolved) continue;
    if (seen.has(resolved)) continue;
    seen.add(resolved);
    const text = (a.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 80);
    hints.push({
      label: labelForIndex(hints.length),
      text: text || resolved,
      url: resolved,
    });
  }

  return hints;
}

export function findByLabel(hints: LinkHint[], label: string): LinkHint | undefined {
  return hints.find((h) => h.label === label);
}

export function prefixMatches(hints: LinkHint[], prefix: string): LinkHint[] {
  if (!prefix) return hints;
  return hints.filter((h) => h.label.startsWith(prefix));
}

export const _internal = { labelForIndex, LABEL_ALPHABET };
