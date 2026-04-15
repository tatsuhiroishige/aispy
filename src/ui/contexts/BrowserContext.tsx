import { createContext, useCallback, useContext, useState, useRef } from 'react';
import type { ReactNode } from 'react';
import {
  type TabCollection,
  type Tab,
  createTabCollection,
  addTab,
  closeTab as closeTabFn,
  switchTab as switchTabFn,
  switchTabByIndex as switchTabByIndexFn,
  activeTab as activeTabFn,
  updateTab,
  pushHistoryEntry,
  updateCurrentEntry,
  navigateBack,
  navigateForward,
  currentEntry,
} from '../../browser/tabs.js';
import type { HistoryEntry } from '../../browser/history.js';
import {
  navigateStream as runNavigateStream,
  submitForm as runSubmitForm,
  type NavigationResult,
} from '../../browser/navigator.js';
import type { FormSpec } from '../../browser/forms.js';

export interface BrowserActions {
  navigate(url: string): Promise<NavigationResult>;
  newTab(url?: string): Promise<NavigationResult | null>;
  closeActiveTab(): void;
  switchTo(id: string): void;
  switchToIndex(index: number): void;
  back(): void;
  forward(): void;
  reload(): Promise<NavigationResult | null>;
  setScroll(offset: number): void;
  addFetchedTab(entry: HistoryEntry): void;
  updateTabByUrl(url: string, patch: Partial<HistoryEntry>): void;
  submitForm(form: FormSpec, values: Record<string, string>): Promise<NavigationResult>;
}

export interface BrowserContextValue extends BrowserActions {
  tabs: TabCollection;
  activeTab: Tab | null;
  currentEntry: HistoryEntry | null;
}

const BrowserContext = createContext<BrowserContextValue | null>(null);

interface BrowserProviderProps {
  children: ReactNode;
  navigateStreamFn?: typeof runNavigateStream;
  width?: number;
}

export function BrowserProvider({
  children,
  navigateStreamFn = runNavigateStream,
  width,
}: BrowserProviderProps) {
  const [tabs, setTabs] = useState<TabCollection>(() => createTabCollection());
  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;

  const withActive = useCallback(
    (fn: (tc: TabCollection, active: Tab) => TabCollection): TabCollection => {
      const active = activeTabFn(tabsRef.current);
      if (!active) return tabsRef.current;
      return fn(tabsRef.current, active);
    },
    [],
  );

  const performNavigate = useCallback(
    async (tabId: string, url: string): Promise<NavigationResult> => {
      setTabs((tc) => updateTab(tc, tabId, (t) => ({ ...t, loading: true, loadError: undefined })));
      let firstYield = true;
      let finalResult: NavigationResult = { ok: false, error: 'no response' };
      for await (const update of navigateStreamFn(url, { width })) {
        if (!update.ok) {
          setTabs((tc) =>
            updateTab(tc, tabId, (t) => ({
              ...t,
              loading: false,
              loadError: update.error ?? 'unknown error',
              decodeProgress: undefined,
            })),
          );
          finalResult = { ok: false, error: update.error };
          continue;
        }
        if (!update.entry) continue;
        if (firstYield) {
          setTabs((tc) => pushHistoryEntry(tc, tabId, update.entry!));
          firstYield = false;
        } else {
          setTabs((tc) => updateCurrentEntry(tc, tabId, update.entry!));
        }
        const progress =
          update.total !== undefined && update.total > 0
            ? { decoded: update.decoded ?? 0, total: update.total }
            : undefined;
        if (update.phase === 'final') {
          setTabs((tc) =>
            updateTab(tc, tabId, (t) => ({
              ...t,
              loading: false,
              decodeProgress: undefined,
            })),
          );
        } else if (progress) {
          setTabs((tc) =>
            updateTab(tc, tabId, (t) => ({ ...t, decodeProgress: progress })),
          );
        }
        finalResult = { ok: true, entry: update.entry };
      }
      return finalResult;
    },
    [navigateStreamFn, width],
  );

  const navigate = useCallback(
    async (url: string): Promise<NavigationResult> => {
      const active = activeTabFn(tabsRef.current);
      if (!active) {
        const next = addTab(tabsRef.current);
        tabsRef.current = next;
        setTabs(next);
        return performNavigate(next.tabs[next.activeIndex]!.id, url);
      }
      return performNavigate(active.id, url);
    },
    [performNavigate],
  );

  const newTab = useCallback(
    async (url?: string): Promise<NavigationResult | null> => {
      const next = addTab(tabsRef.current);
      tabsRef.current = next;
      setTabs(next);
      if (!url) return null;
      const id = next.tabs[next.activeIndex]!.id;
      return performNavigate(id, url);
    },
    [performNavigate],
  );

  const addFetchedTab = useCallback((entry: HistoryEntry) => {
    setTabs((tc) => addTab(tc, entry));
  }, []);

  const updateTabByUrl = useCallback(
    (url: string, patch: Partial<HistoryEntry>) => {
      setTabs((tc) => {
        // Find the most recently opened tab whose current entry matches the url
        for (let i = tc.tabs.length - 1; i >= 0; i--) {
          const tab = tc.tabs[i]!;
          const entry = currentEntry(tab);
          if (entry?.url === url) {
            return updateCurrentEntry(tc, tab.id, patch);
          }
        }
        return tc;
      });
    },
    [],
  );

  const submitForm = useCallback(
    async (form: FormSpec, values: Record<string, string>): Promise<NavigationResult> => {
      const active = activeTabFn(tabsRef.current);
      if (!active) {
        const result = await runSubmitForm(form, values, { width });
        if (result.ok && result.entry) {
          setTabs((tc) => addTab(tc, result.entry!));
        }
        return result;
      }
      setTabs((tc) =>
        updateTab(tc, active.id, (t) => ({ ...t, loading: true, loadError: undefined })),
      );
      const result = await runSubmitForm(form, values, { width });
      if (result.ok && result.entry) {
        setTabs((tc) => pushHistoryEntry(tc, active.id, result.entry!));
      } else {
        setTabs((tc) =>
          updateTab(tc, active.id, (t) => ({
            ...t,
            loading: false,
            loadError: result.error ?? 'submit failed',
          })),
        );
      }
      return result;
    },
    [width],
  );

  const closeActiveTab = useCallback(() => {
    const active = activeTabFn(tabsRef.current);
    if (!active) return;
    setTabs((tc) => closeTabFn(tc, active.id));
  }, []);

  const switchTo = useCallback((id: string) => {
    setTabs((tc) => switchTabFn(tc, id));
  }, []);

  const switchToIndex = useCallback((index: number) => {
    setTabs((tc) => switchTabByIndexFn(tc, index));
  }, []);

  const back = useCallback(() => {
    withActive((tc, active) => {
      const next = navigateBack(tc, active.id);
      setTabs(next);
      return next;
    });
  }, [withActive]);

  const forward = useCallback(() => {
    withActive((tc, active) => {
      const next = navigateForward(tc, active.id);
      setTabs(next);
      return next;
    });
  }, [withActive]);

  const reload = useCallback(async (): Promise<NavigationResult | null> => {
    const active = activeTabFn(tabsRef.current);
    if (!active) return null;
    const entry = currentEntry(active);
    if (!entry) return null;
    return performNavigate(active.id, entry.url);
  }, [performNavigate]);

  const setScroll = useCallback((offset: number) => {
    withActive((tc, active) => {
      const next = updateTab(tc, active.id, (t) => ({ ...t, scrollOffset: offset }));
      setTabs(next);
      return next;
    });
  }, [withActive]);

  const active = activeTabFn(tabs);
  const entry = active ? currentEntry(active) : null;

  const value: BrowserContextValue = {
    tabs,
    activeTab: active,
    currentEntry: entry,
    navigate,
    newTab,
    closeActiveTab,
    switchTo,
    switchToIndex,
    back,
    forward,
    reload,
    setScroll,
    addFetchedTab,
    updateTabByUrl,
    submitForm,
  };

  return <BrowserContext value={value}>{children}</BrowserContext>;
}

export function useBrowser(): BrowserContextValue {
  const ctx = useContext(BrowserContext);
  if (!ctx) throw new Error('BrowserProvider missing');
  return ctx;
}
