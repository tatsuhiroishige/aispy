import { describe, it, expect, beforeEach } from 'vitest';
import {
  createTabCollection,
  addTab,
  closeTab,
  switchTab,
  switchTabByIndex,
  activeTab,
  updateTab,
  pushHistoryEntry,
  navigateBack,
  navigateForward,
  currentEntry,
  resetTabIds,
} from './tabs.js';

function entry(url: string): { url: string; title: string; content: string } {
  return { url, title: url, content: `body-${url}` };
}

describe('TabCollection', () => {
  beforeEach(() => resetTabIds());

  it('starts empty with activeIndex -1', () => {
    const tc = createTabCollection();
    expect(tc.tabs).toEqual([]);
    expect(tc.activeIndex).toBe(-1);
    expect(activeTab(tc)).toBeNull();
  });

  it('addTab appends and makes it active', () => {
    let tc = createTabCollection();
    tc = addTab(tc, entry('a'));
    expect(tc.tabs.length).toBe(1);
    expect(tc.activeIndex).toBe(0);
    expect(activeTab(tc)?.history.entries[0]?.url).toBe('a');
    tc = addTab(tc, entry('b'));
    expect(tc.activeIndex).toBe(1);
  });

  it('closeTab shifts activeIndex correctly', () => {
    let tc = createTabCollection();
    tc = addTab(tc, entry('a'));
    tc = addTab(tc, entry('b'));
    tc = addTab(tc, entry('c'));
    const b = tc.tabs[1]!;
    tc = closeTab(tc, b.id);
    expect(tc.tabs.map((t) => t.history.entries[0]?.url)).toEqual(['a', 'c']);
    expect(tc.activeIndex).toBe(1); // was at c, now at index 1
  });

  it('closeTab on last-is-active moves active to previous', () => {
    let tc = addTab(addTab(createTabCollection(), entry('a')), entry('b'));
    tc = closeTab(tc, tc.tabs[1]!.id);
    expect(tc.activeIndex).toBe(0);
  });

  it('closeTab on sole tab yields empty collection', () => {
    let tc = addTab(createTabCollection(), entry('a'));
    tc = closeTab(tc, tc.tabs[0]!.id);
    expect(tc.tabs).toEqual([]);
    expect(tc.activeIndex).toBe(-1);
  });

  it('switchTab by id and by index', () => {
    let tc = createTabCollection();
    tc = addTab(tc, entry('a'));
    tc = addTab(tc, entry('b'));
    tc = addTab(tc, entry('c'));
    const t2 = tc.tabs[1]!;
    tc = switchTab(tc, t2.id);
    expect(tc.activeIndex).toBe(1);
    tc = switchTabByIndex(tc, 2);
    expect(tc.activeIndex).toBe(2);
    tc = switchTabByIndex(tc, 99);
    expect(tc.activeIndex).toBe(2); // no-op
  });

  it('pushHistoryEntry adds to tab history and resets scroll', () => {
    let tc = addTab(createTabCollection(), entry('a'));
    const id = tc.tabs[0]!.id;
    tc = updateTab(tc, id, (t) => ({ ...t, scrollOffset: 42 }));
    tc = pushHistoryEntry(tc, id, entry('b'));
    const t = tc.tabs[0]!;
    expect(t.history.entries.map((e) => e.url)).toEqual(['a', 'b']);
    expect(t.scrollOffset).toBe(0);
    expect(currentEntry(t)?.url).toBe('b');
  });

  it('navigateBack/Forward clears scroll', () => {
    let tc = addTab(createTabCollection(), entry('a'));
    const id = tc.tabs[0]!.id;
    tc = pushHistoryEntry(tc, id, entry('b'));
    tc = updateTab(tc, id, (t) => ({ ...t, scrollOffset: 10 }));
    tc = navigateBack(tc, id);
    expect(currentEntry(tc.tabs[0]!)?.url).toBe('a');
    expect(tc.tabs[0]!.scrollOffset).toBe(0);
    tc = navigateForward(tc, id);
    expect(currentEntry(tc.tabs[0]!)?.url).toBe('b');
  });
});
