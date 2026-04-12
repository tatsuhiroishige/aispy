import { Box, Text, useStdout } from 'ink';
import type { SessionStats } from '../../core/store.js';
import type { FocusPane } from '../types.js';

interface StatusBarProps {
  stats: SessionStats;
  connected: boolean;
  focusPane: FocusPane;
  hasViewerContent: boolean;
}

function formatCompactNumber(n: number): string {
  if (n > 999) {
    return `${(n / 1000).toFixed(1)}k`;
  }
  return n.toLocaleString();
}

function formatElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (min === 0) return `${sec}s`;
  return `${min}m${sec.toString().padStart(2, '0')}s`;
}

function getKeyHints(focusPane: FocusPane, hasViewerContent: boolean): string {
  if (focusPane === 'log') {
    return '[Tab] viewer  [j/k] scroll  [Enter] preview  [q] quit';
  }
  const openHint = hasViewerContent ? '  [o] browser' : '';
  return `[Tab] log  [j/k] scroll${openHint}  [q] back`;
}

export function StatusBar({ stats, connected, focusPane, hasViewerContent }: StatusBarProps) {
  const { stdout } = useStdout();
  const width = stdout?.columns ?? 80;

  const elapsed = formatElapsed(stats.elapsedMs);
  const narrow = width < 60;

  const connectionIndicator = narrow
    ? (connected ? '●' : '○')
    : (connected ? '● connected' : '○ disconnected');
  const connectionColor = connected ? 'green' : 'red';

  const statsText = narrow
    ? `${stats.searchCount} srch | ${stats.fetchCount} pg | ${formatCompactNumber(stats.totalTokens)} tok | ${elapsed}`
    : `${stats.searchCount} searches | ${stats.fetchCount} pages | ${stats.totalTokens.toLocaleString()} tokens | ${elapsed}`;

  const keyHints = getKeyHints(focusPane, hasViewerContent);

  return (
    <Box borderStyle="single" borderColor="gray" width="100%" justifyContent="space-between">
      <Box>
        <Text color={connectionColor}>{connectionIndicator}</Text>
        <Text> | </Text>
        <Text>{statsText}</Text>
      </Box>
      <Text dimColor>{keyHints}</Text>
    </Box>
  );
}
