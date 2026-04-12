import { useState, useCallback, useRef, useEffect } from 'react';
import { writeFileSync } from 'node:fs';
import { Box, Text, useApp, useStdout, useInput } from 'ink';
import type { EventStore } from '../core/store.js';
import { openInBrowser } from '../core/browserOpen.js';
import { exportToJson, exportToMarkdown } from '../core/exportSession.js';
import { StoreProvider } from './contexts/StoreContext.js';
import { useEventStore } from './hooks/useEventStore.js';
import { useKeyboard } from './hooks/useKeyboard.js';
import { ActivityLog } from './components/ActivityLog.js';
import { PageViewer } from './components/PageViewer.js';
import { StatusBar } from './components/StatusBar.js';
import { FilterInput } from './components/FilterInput.js';
import { StatsModal } from './components/StatsModal.js';
import type { FocusPane, ViewerState } from './types.js';

interface AppProps {
  store: EventStore;
  connected?: boolean;
}

function AppInner({ connected = true }: { connected: boolean }) {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const rows = stdout.rows ?? 24;

  const { events, stats } = useEventStore();

  const [focusPane, setFocusPane] = useState<FocusPane>('log');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [viewerState, setViewerState] = useState<ViewerState | null>(null);
  const [filterText, setFilterText] = useState('');
  const [isFiltering, setIsFiltering] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const exportTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastFetchCountRef = useRef(0);
  const lastSearchCountRef = useRef(0);

  useEffect(() => {
    return () => {
      if (exportTimerRef.current) clearTimeout(exportTimerRef.current);
    };
  }, []);

  // Auto-open PageViewer on new Fetch, auto-close on new Search
  useEffect(() => {
    const searchCount = events.filter((e) => e.type === 'search').length;
    const fetchEvents = events.filter((e) => e.type === 'fetch');

    // New search arrived → close viewer to show search results
    if (searchCount > lastSearchCountRef.current) {
      setViewerState(null);
      lastSearchCountRef.current = searchCount;
    }

    // New fetch arrived → open/update viewer with latest page
    if (fetchEvents.length > lastFetchCountRef.current) {
      const latest = fetchEvents[fetchEvents.length - 1];
      if (latest && latest.type === 'fetch') {
        setViewerState({ url: latest.url, content: latest.content, scrollOffset: 0 });
      }
      lastFetchCountRef.current = fetchEvents.length;
    }
  }, [events]);

  const contentHeight = Math.max(5, rows - 4);

  const handleTab = useCallback(() => {
    if (viewerState) {
      setFocusPane((prev) => (prev === 'log' ? 'viewer' : 'log'));
    }
  }, [viewerState]);

  const handleDown = useCallback(() => {
    if (focusPane === 'log') {
      setSelectedIndex((prev) => Math.min(prev + 1, Math.max(0, events.length - 1)));
    } else if (viewerState) {
      setViewerState((prev) => {
        if (!prev) return prev;
        const maxOffset = Math.max(0, prev.content.split('\n').length - 1);
        return { ...prev, scrollOffset: Math.min(prev.scrollOffset + 1, maxOffset) };
      });
    }
  }, [focusPane, events.length, viewerState]);

  const handleUp = useCallback(() => {
    if (focusPane === 'log') {
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (viewerState) {
      setViewerState((prev) => {
        if (!prev) return prev;
        return { ...prev, scrollOffset: Math.max(prev.scrollOffset - 1, 0) };
      });
    }
  }, [focusPane, viewerState]);

  const handleEnter = useCallback(() => {
    if (events.length === 0) return;
    const event = events[selectedIndex];
    if (!event) return;
    if (event.type === 'fetch-start') return;

    if (event.type === 'fetch') {
      setViewerState({ url: event.url, content: event.content, scrollOffset: 0 });
      setFocusPane('viewer');
    } else if (event.type === 'search') {
      const text = event.results
        .map((r, i) => `${i + 1}. ${r.title}\n   ${r.url}\n   ${r.snippet}`)
        .join('\n\n');
      setViewerState({ url: `search: ${event.query}`, content: text, scrollOffset: 0 });
      setFocusPane('viewer');
    }
  }, [events, selectedIndex]);

  const handleOpen = useCallback(() => {
    if (viewerState && !viewerState.url.startsWith('search:')) {
      openInBrowser(viewerState.url);
    }
  }, [viewerState]);

  const handleQuit = useCallback(() => {
    if (viewerState) {
      setViewerState(null);
      setFocusPane('log');
    } else {
      exit();
    }
  }, [viewerState, exit]);

  const handleFilter = useCallback(() => {
    setIsFiltering(true);
  }, []);

  const handleStats = useCallback(() => {
    setShowStats((s) => !s);
  }, []);

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
    exportTimerRef.current = setTimeout(() => {
      setExportMessage(null);
    }, 3000);
  }, [events, stats]);

  const handleEscape = useCallback(() => {
    setIsFiltering(false);
    setFilterText('');
    setShowStats(false);
  }, []);

  const filteredEvents = filterText
    ? events.filter((e) => {
        if (e.type === 'search') return e.query.toLowerCase().includes(filterText.toLowerCase());
        if (e.type === 'fetch' || e.type === 'fetch-start') return e.url.toLowerCase().includes(filterText.toLowerCase());
        return false;
      })
    : events;

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
      if (key.return || key.tab || key.upArrow || key.downArrow) {
        return;
      }
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
    },
    { isActive: !isFiltering },
  );

  const showViewer = viewerState !== null;

  return (
    <Box flexDirection="column" width="100%" height={rows}>
      <Box flexGrow={1} flexDirection="column">
        {showViewer ? (
          <PageViewer
            viewer={viewerState}
            focused={focusPane === 'viewer'}
            height={contentHeight}
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
      <StatusBar stats={stats} connected={connected} focusPane={showViewer ? 'viewer' : 'log'} hasViewerContent={showViewer} />
      {showStats && <StatsModal events={events} stats={stats} />}
    </Box>
  );
}

export function App({ store, connected = true }: AppProps) {
  return (
    <StoreProvider store={store}>
      <AppInner connected={connected} />
    </StoreProvider>
  );
}
