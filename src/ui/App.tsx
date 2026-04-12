import { useState, useCallback } from 'react';
import { Box, useApp, useStdout } from 'ink';
import type { EventStore } from '../core/store.js';
import { openInBrowser } from '../core/browserOpen.js';
import { StoreProvider } from './contexts/StoreContext.js';
import { useEventStore } from './hooks/useEventStore.js';
import { useKeyboard } from './hooks/useKeyboard.js';
import { ActivityLog } from './components/ActivityLog.js';
import { PageViewer } from './components/PageViewer.js';
import { StatusBar } from './components/StatusBar.js';
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

  const contentHeight = Math.max(5, rows - 4);

  const handleTab = useCallback(() => {
    setFocusPane((prev) => (prev === 'log' ? 'viewer' : 'log'));
  }, []);

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

  useKeyboard({
    onTab: handleTab,
    onUp: handleUp,
    onDown: handleDown,
    onEnter: handleEnter,
    onOpen: handleOpen,
    onQuit: handleQuit,
  });

  return (
    <Box flexDirection="column" width="100%" height={rows}>
      <Box flexGrow={1}>
        <Box width="40%">
          <ActivityLog
            events={events}
            focused={focusPane === 'log'}
            selectedIndex={selectedIndex}
            height={contentHeight}
          />
        </Box>
        <Box flexGrow={1}>
          <PageViewer
            viewer={viewerState}
            focused={focusPane === 'viewer'}
            height={contentHeight}
          />
        </Box>
      </Box>
      <StatusBar stats={stats} connected={connected} focusPane={focusPane} hasViewerContent={viewerState !== null} />
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
