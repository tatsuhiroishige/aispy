import {
  type History,
  type HistoryEntry,
  createHistory,
  pushEntry,
  back as historyBack,
  forward as historyForward,
  current as historyCurrent,
} from './history.js';

export interface DecodeProgress {
  decoded: number;
  total: number;
}

export interface Tab {
  id: string;
  history: History;
  scrollOffset: number;
  loading: boolean;
  loadError?: string;
  decodeProgress?: DecodeProgress;
}

export interface TabCollection {
  tabs: Tab[];
  activeIndex: number;
}

let idCounter = 0;

function nextId(): string {
  idCounter += 1;
  return `t${idCounter}`;
}

export function resetTabIds(): void {
  idCounter = 0;
}

export function createTabCollection(): TabCollection {
  return { tabs: [], activeIndex: -1 };
}

export function addTab(tc: TabCollection, entry?: HistoryEntry): TabCollection {
  const history = entry ? pushEntry(createHistory(), entry) : createHistory();
  const tab: Tab = {
    id: nextId(),
    history,
    scrollOffset: 0,
    loading: false,
  };
  const tabs = [...tc.tabs, tab];
  return { tabs, activeIndex: tabs.length - 1 };
}

export function closeTab(tc: TabCollection, id: string): TabCollection {
  const idx = tc.tabs.findIndex((t) => t.id === id);
  if (idx < 0) return tc;
  const tabs = [...tc.tabs.slice(0, idx), ...tc.tabs.slice(idx + 1)];
  if (tabs.length === 0) return { tabs: [], activeIndex: -1 };
  let activeIndex = tc.activeIndex;
  if (idx < activeIndex) activeIndex -= 1;
  else if (idx === activeIndex) activeIndex = Math.min(activeIndex, tabs.length - 1);
  return { tabs, activeIndex };
}

export function switchTab(tc: TabCollection, id: string): TabCollection {
  const idx = tc.tabs.findIndex((t) => t.id === id);
  if (idx < 0) return tc;
  return { tabs: tc.tabs, activeIndex: idx };
}

export function switchTabByIndex(tc: TabCollection, index: number): TabCollection {
  if (index < 0 || index >= tc.tabs.length) return tc;
  return { tabs: tc.tabs, activeIndex: index };
}

export function activeTab(tc: TabCollection): Tab | null {
  if (tc.activeIndex < 0 || tc.activeIndex >= tc.tabs.length) return null;
  return tc.tabs[tc.activeIndex]!;
}

export function updateTab(
  tc: TabCollection,
  id: string,
  updater: (t: Tab) => Tab,
): TabCollection {
  const idx = tc.tabs.findIndex((t) => t.id === id);
  if (idx < 0) return tc;
  const tabs = tc.tabs.slice();
  tabs[idx] = updater(tabs[idx]!);
  return { tabs, activeIndex: tc.activeIndex };
}

export function pushHistoryEntry(
  tc: TabCollection,
  id: string,
  entry: HistoryEntry,
): TabCollection {
  return updateTab(tc, id, (t) => ({
    ...t,
    history: pushEntry(t.history, entry),
    scrollOffset: 0,
    loading: false,
    loadError: undefined,
  }));
}

export function updateCurrentEntry(
  tc: TabCollection,
  id: string,
  patch: Partial<HistoryEntry>,
): TabCollection {
  return updateTab(tc, id, (t) => {
    const idx = t.history.index;
    if (idx < 0 || idx >= t.history.entries.length) return t;
    const entries = t.history.entries.slice();
    entries[idx] = { ...entries[idx]!, ...patch };
    return {
      ...t,
      history: { ...t.history, entries },
    };
  });
}

export function navigateBack(tc: TabCollection, id: string): TabCollection {
  return updateTab(tc, id, (t) => ({
    ...t,
    history: historyBack(t.history),
    scrollOffset: 0,
  }));
}

export function navigateForward(tc: TabCollection, id: string): TabCollection {
  return updateTab(tc, id, (t) => ({
    ...t,
    history: historyForward(t.history),
    scrollOffset: 0,
  }));
}

export function currentEntry(tab: Tab): HistoryEntry | null {
  return historyCurrent(tab.history);
}
