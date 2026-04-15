import type { HistoryEntry } from './history.js';
import type { Bookmark } from '../core/bookmarks.js';
import type { TabCollection } from './tabs.js';
import { currentEntry } from './tabs.js';

export interface HistoryItem {
  url: string;
  title: string;
  source: 'bookmark' | 'history';
}

export function collectHistoryItems(
  tabs: TabCollection,
  bookmarks: readonly Bookmark[],
): HistoryItem[] {
  const items: HistoryItem[] = [];
  const seen = new Set<string>();

  for (const b of bookmarks) {
    if (seen.has(b.url)) continue;
    seen.add(b.url);
    items.push({ url: b.url, title: b.title, source: 'bookmark' });
  }

  for (const tab of tabs.tabs) {
    for (const entry of tab.history.entries) {
      if (seen.has(entry.url)) continue;
      seen.add(entry.url);
      items.push({ url: entry.url, title: entry.title, source: 'history' });
    }
    const cur = currentEntry(tab);
    if (cur && !seen.has(cur.url)) {
      seen.add(cur.url);
      items.push({ url: cur.url, title: cur.title, source: 'history' });
    }
  }

  return items;
}

function scoreMatch(haystack: string, needle: string): number {
  if (!needle) return 1;
  const h = haystack.toLowerCase();
  const n = needle.toLowerCase();
  if (h === n) return 100;
  if (h.startsWith(n)) return 80;
  if (h.includes(n)) return 60;
  // fuzzy: are all chars of needle in order within haystack?
  let hi = 0;
  for (const ch of n) {
    hi = h.indexOf(ch, hi);
    if (hi < 0) return 0;
    hi += 1;
  }
  return 20;
}

export function searchHistory(
  items: readonly HistoryItem[],
  query: string,
): HistoryItem[] {
  if (!query.trim()) return [...items];
  const q = query.trim();
  const scored = items.map((item) => {
    const titleScore = scoreMatch(item.title, q);
    const urlScore = scoreMatch(item.url, q);
    return { item, score: Math.max(titleScore, urlScore) };
  });
  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((s) => s.item);
}

export type { HistoryEntry };
