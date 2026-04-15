import { useState, useCallback, useRef, useEffect } from 'react';
import { writeFileSync } from 'node:fs';
import { Box, Text, useApp, useStdout, useInput } from 'ink';
import type { EventStore } from '../core/store.js';
import { openInBrowser } from '../core/browserOpen.js';
import { exportToJson, exportToMarkdown } from '../core/exportSession.js';
import { StoreProvider } from './contexts/StoreContext.js';
import { BrowserProvider, useBrowser } from './contexts/BrowserContext.js';
import { useEventStore } from './hooks/useEventStore.js';
import { useKeyboard } from './hooks/useKeyboard.js';
import { ActivityLog } from './components/ActivityLog.js';
import { PageViewer } from './components/PageViewer.js';
import { StatusBar } from './components/StatusBar.js';
import { FilterInput } from './components/FilterInput.js';
import { StatsModal } from './components/StatsModal.js';
import { UrlBar } from './components/UrlBar.js';
import { TabBar } from './components/TabBar.js';
import { LinkHintsModal } from './components/LinkHintsModal.js';
import { canBack, canForward } from '../browser/history.js';
import { findByLabel, prefixMatches } from '../browser/linkHints.js';
import type { FocusPane } from './types.js';

interface AppProps {
  store: EventStore;
  connected?: boolean;
}

function AppInner({ connected = true }: { connected: boolean }) {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const rows = stdout.rows ?? 24;

  const { events, stats } = useEventStore();
  const browser = useBrowser();

  const [focusPane, setFocusPane] = useState<FocusPane>('log');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [urlEditing, setUrlEditing] = useState(false);
  const [urlDraft, setUrlDraft] = useState('');
  const [filterText, setFilterText] = useState('');
  const [isFiltering, setIsFiltering] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [linkHintsOpen, setLinkHintsOpen] = useState(false);
  const [linkHintsPrefix, setLinkHintsPrefix] = useState('');
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const exportTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastFetchCountRef = useRef(0);
  const lastSearchCountRef = useRef(0);

  useEffect(() => {
    return () => {
      if (exportTimerRef.current) clearTimeout(exportTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const searchCount = events.filter((e) => e.type === 'search').length;
    const fetchEvents = events.filter((e) => e.type === 'fetch');

    if (fetchEvents.length > lastFetchCountRef.current) {
      const latest = fetchEvents[fetchEvents.length - 1];
      if (latest && latest.type === 'fetch') {
        browser.addFetchedTab({
          url: latest.url,
          title: latest.url,
          content: latest.content,
        });
        setFocusPane('viewer');
      }
      lastFetchCountRef.current = fetchEvents.length;
    }
    if (searchCount > lastSearchCountRef.current) {
      lastSearchCountRef.current = searchCount;
    }
  }, [events, browser]);

  const currentEntry = browser.currentEntry;
  const activeTab = browser.activeTab;
  const viewerState = currentEntry
    ? {
        url: currentEntry.url,
        content: currentEntry.content,
        scrollOffset: activeTab?.scrollOffset ?? 0,
      }
    : null;
  const hasViewer = viewerState !== null;

  const contentHeight = Math.max(5, rows - 6);

  const handleTab = useCallback(() => {
    if (hasViewer) setFocusPane((p) => (p === 'log' ? 'viewer' : 'log'));
  }, [hasViewer]);

  const handleDown = useCallback(() => {
    if (hasViewer && activeTab && currentEntry) {
      const max = Math.max(0, currentEntry.content.split('\n').length - 1);
      browser.setScroll(Math.min((activeTab.scrollOffset ?? 0) + 1, max));
    } else {
      setSelectedIndex((p) => Math.min(p + 1, Math.max(0, events.length - 1)));
    }
  }, [events.length, hasViewer, activeTab, currentEntry, browser]);

  const handleUp = useCallback(() => {
    if (hasViewer && activeTab) {
      browser.setScroll(Math.max((activeTab.scrollOffset ?? 0) - 1, 0));
    } else {
      setSelectedIndex((p) => Math.max(p - 1, 0));
    }
  }, [hasViewer, activeTab, browser]);

  const handleEnter = useCallback(() => {
    if (events.length === 0) return;
    const event = events[selectedIndex];
    if (!event || event.type === 'fetch-start') return;

    if (event.type === 'fetch') {
      browser.addFetchedTab({
        url: event.url,
        title: event.url,
        content: event.content,
        imagePrologue: event.imagePrologue,
      });
      setFocusPane('viewer');
    } else if (event.type === 'search') {
      const text = event.results
        .map((r, i) => `${i + 1}. ${r.title}\n   ${r.url}\n   ${r.snippet}`)
        .join('\n\n');
      browser.addFetchedTab({
        url: `search: ${event.query}`,
        title: `search: ${event.query}`,
        content: text,
      });
      setFocusPane('viewer');
    }
  }, [events, selectedIndex, browser]);

  const handleOpen = useCallback(() => {
    if (currentEntry && !currentEntry.url.startsWith('search:')) {
      openInBrowser(currentEntry.url);
    }
  }, [currentEntry]);

  const handleQuit = useCallback(() => {
    if (activeTab) {
      browser.closeActiveTab();
      if (browser.tabs.tabs.length <= 1) setFocusPane('log');
    } else {
      exit();
    }
  }, [activeTab, browser, exit]);

  const handleFilter = useCallback(() => setIsFiltering(true), []);
  const handleStats = useCallback(() => setShowStats((s) => !s), []);

  const handleExport = useCallback(() => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const ts = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const jsonPath = `aispy-session-${ts}.json`;
    const mdPath = `aispy-session-${ts}.md`;

    try {
      writeFileSync(jsonPath, exportToJson(events, stats));
      writeFileSync(mdPath, exportToMarkdown(events, stats));
      setExportMessage(`Exported: ${jsonPath}, ${mdPath}`);
    } catch (err) {
      setExportMessage(`Export failed: ${err instanceof Error ? err.message : String(err)}`);
    }

    if (exportTimerRef.current) clearTimeout(exportTimerRef.current);
    exportTimerRef.current = setTimeout(() => setExportMessage(null), 3000);
  }, [events, stats]);

  const handleEscape = useCallback(() => {
    setIsFiltering(false);
    setFilterText('');
    setShowStats(false);
    setUrlEditing(false);
    setUrlDraft('');
    setLinkHintsOpen(false);
    setLinkHintsPrefix('');
  }, []);

  const handleLinkHints = useCallback(() => {
    if (!currentEntry?.links || currentEntry.links.length === 0) return;
    setLinkHintsOpen(true);
    setLinkHintsPrefix('');
  }, [currentEntry]);

  const handleGoUrl = useCallback(() => {
    setUrlEditing(true);
    setUrlDraft(currentEntry?.url ?? '');
  }, [currentEntry]);

  const handleSubmitUrl = useCallback(async () => {
    const url = urlDraft.trim();
    setUrlEditing(false);
    setUrlDraft('');
    if (!url) return;
    if (activeTab) {
      await browser.navigate(url);
    } else {
      await browser.newTab(url);
    }
    setFocusPane('viewer');
  }, [urlDraft, browser, activeTab]);

  const handleBack = useCallback(() => browser.back(), [browser]);
  const handleForward = useCallback(() => browser.forward(), [browser]);
  const handleReload = useCallback(() => {
    void browser.reload();
  }, [browser]);
  const handleNewTab = useCallback(() => {
    void browser.newTab();
    setUrlEditing(true);
    setUrlDraft('');
  }, [browser]);
  const handleCloseTab = useCallback(() => browser.closeActiveTab(), [browser]);
  const handleSwitchTab = useCallback(
    (index: number) => browser.switchToIndex(index),
    [browser],
  );

  const filteredEvents = filterText
    ? events.filter((e) => {
        if (e.type === 'search') return e.query.toLowerCase().includes(filterText.toLowerCase());
        if (e.type === 'fetch' || e.type === 'fetch-start')
          return e.url.toLowerCase().includes(filterText.toLowerCase());
        return false;
      })
    : events;

  useInput(
    (input, key) => {
      if (key.escape) {
        handleEscape();
        return;
      }
      if (key.return) {
        void handleSubmitUrl();
        return;
      }
      if (key.backspace || key.delete) {
        setUrlDraft((p) => p.slice(0, -1));
        return;
      }
      if (input && !key.ctrl && !key.meta) {
        setUrlDraft((p) => p + input);
      }
    },
    { isActive: urlEditing },
  );

  useInput(
    (input, key) => {
      if (key.escape) {
        handleEscape();
        return;
      }
      if (key.backspace || key.delete) {
        setLinkHintsPrefix((p) => p.slice(0, -1));
        return;
      }
      if (!input || key.ctrl || key.meta) return;
      const ch = input.toLowerCase();
      if (!/^[a-z]$/.test(ch)) return;
      const nextPrefix = linkHintsPrefix + ch;
      const hints = currentEntry?.links ?? [];
      const match = findByLabel(hints, nextPrefix);
      if (match) {
        setLinkHintsOpen(false);
        setLinkHintsPrefix('');
        void browser.navigate(match.url);
        return;
      }
      if (prefixMatches(hints, nextPrefix).length === 0) {
        return;
      }
      setLinkHintsPrefix(nextPrefix);
    },
    { isActive: linkHintsOpen },
  );

  useInput(
    (input, key) => {
      if (key.escape) {
        handleEscape();
        return;
      }
      if (key.backspace || key.delete) {
        setFilterText((prev) => prev.slice(0, -1));
        return;
      }
      if (key.return || key.tab || key.upArrow || key.downArrow) return;
      if (input && !key.ctrl && !key.meta) {
        setFilterText((prev) => prev + input);
      }
    },
    { isActive: isFiltering },
  );

  useKeyboard(
    {
      onTab: handleTab,
      onUp: handleUp,
      onDown: handleDown,
      onEnter: handleEnter,
      onOpen: handleOpen,
      onQuit: handleQuit,
      onFilter: handleFilter,
      onStats: handleStats,
      onEscape: handleEscape,
      onExport: handleExport,
      onGoUrl: handleGoUrl,
      onBack: handleBack,
      onForward: handleForward,
      onReload: handleReload,
      onNewTab: handleNewTab,
      onCloseTab: handleCloseTab,
      onSwitchTab: handleSwitchTab,
      onLinkHints: handleLinkHints,
    },
    { isActive: !isFiltering && !urlEditing && !linkHintsOpen },
  );

  const back = activeTab ? canBack(activeTab.history) : false;
  const forward = activeTab ? canForward(activeTab.history) : false;

  return (
    <Box flexDirection="column" width="100%" height={rows}>
      <UrlBar
        url={currentEntry?.url ?? null}
        loading={activeTab?.loading ?? false}
        loadError={activeTab?.loadError}
        canBack={back}
        canForward={forward}
        editing={urlEditing}
        draft={urlDraft}
        decodeProgress={activeTab?.decodeProgress}
      />
      <TabBar tabs={browser.tabs.tabs} activeIndex={browser.tabs.activeIndex} />
      <Box flexGrow={1} flexDirection="column">
        {hasViewer ? (
          <PageViewer
            viewer={viewerState}
            focused={focusPane === 'viewer'}
            height={contentHeight}
            imagePrologue={currentEntry?.imagePrologue}
          />
        ) : (
          <>
            <ActivityLog
              events={filteredEvents}
              focused={focusPane === 'log'}
              selectedIndex={selectedIndex}
              height={isFiltering ? contentHeight - 1 : contentHeight}
            />
            {isFiltering && <FilterInput value={filterText} onChange={setFilterText} />}
          </>
        )}
      </Box>
      {exportMessage && (
        <Box>
          <Text color="green">{exportMessage}</Text>
        </Box>
      )}
      <StatusBar
        stats={stats}
        connected={connected}
        focusPane={hasViewer ? 'viewer' : 'log'}
        hasViewerContent={hasViewer}
      />
      {showStats && <StatsModal events={events} stats={stats} />}
      {linkHintsOpen && currentEntry?.links && (
        <LinkHintsModal
          hints={currentEntry.links}
          prefix={linkHintsPrefix}
          height={contentHeight}
        />
      )}
    </Box>
  );
}

export function App({ store, connected = true }: AppProps) {
  return (
    <StoreProvider store={store}>
      <BrowserProvider>
        <AppInner connected={connected} />
      </BrowserProvider>
    </StoreProvider>
  );
}
