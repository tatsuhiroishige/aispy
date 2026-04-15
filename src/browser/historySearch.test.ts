import { describe, it, expect, beforeEach } from 'vitest';
import { collectHistoryItems, searchHistory } from './historySearch.js';
import { addTab, createTabCollection, resetTabIds } from './tabs.js';
import type { Bookmark } from '../core/bookmarks.js';

function entry(url: string, title = url): { url: string; title: string; content: string } {
  return { url, title, content: '' };
}

describe('collectHistoryItems', () => {
  beforeEach(() => resetTabIds());

  it('merges bookmarks first then tab history, dedup by url', () => {
    const bookmarks: Bookmark[] = [
      { url: 'https://bm.com', title: 'Bookmark', addedAt: 0 },
    ];
    let tc = createTabCollection();
    tc = addTab(tc, entry('https://bm.com', 'DupFromTab'));
    tc = addTab(tc, entry('https://tab.com', 'Tab'));
    const items = collectHistoryItems(tc, bookmarks);
    expect(items[0]?.source).toBe('bookmark');
    expect(items[0]?.title).toBe('Bookmark');
    expect(items.map((i) => i.url)).toEqual(['https://bm.com', 'https://tab.com']);
  });

  it('includes all history entries from a tab (not just current)', () => {
    let tc = createTabCollection();
    tc = addTab(tc, entry('https://a.com'));
    // Simulate history push
    const tab = tc.tabs[0]!;
    tab.history.entries.push({ url: 'https://b.com', title: 'b', content: '' });
    const items = collectHistoryItems(tc, []);
    expect(items.some((i) => i.url === 'https://b.com')).toBe(true);
  });
});

describe('searchHistory', () => {
  const items = [
    { url: 'https://en.wikipedia.org/wiki/Tokyo', title: 'Tokyo', source: 'history' as const },
    { url: 'https://example.com', title: 'Example Site', source: 'bookmark' as const },
    { url: 'https://news.ycombinator.com', title: 'Hacker News', source: 'history' as const },
  ];

  it('returns all items for empty query', () => {
    expect(searchHistory(items, '')).toEqual(items);
  });

  it('filters by title substring', () => {
    const result = searchHistory(items, 'tokyo');
    expect(result.map((i) => i.title)).toEqual(['Tokyo']);
  });

  it('filters by URL substring', () => {
    const result = searchHistory(items, 'ycombinator');
    expect(result[0]?.title).toBe('Hacker News');
  });

  it('ranks exact matches higher than substring', () => {
    const q = 'Tokyo';
    const more = [
      ...items,
      { url: 'https://a.com', title: 'About Tokyo cuisine', source: 'history' as const },
    ];
    const result = searchHistory(more, q);
    expect(result[0]?.title).toBe('Tokyo');
  });
});
