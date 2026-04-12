import { Box, Text } from 'ink';
import type { SessionStats } from '../../core/store.js';

interface StatusBarProps {
  stats: SessionStats;
  connected: boolean;
}

export function StatusBar({ stats, connected }: StatusBarProps) {
  const elapsedSec = (stats.elapsedMs / 1000).toFixed(1);
  const connectionIndicator = connected ? '● connected' : '○ disconnected';
  const connectionColor = connected ? 'green' : 'red';

  return (
    <Box borderStyle="single" borderColor="gray" width="100%">
      <Text color={connectionColor}>{connectionIndicator}</Text>
      <Text> | </Text>
      <Text>{stats.searchCount} searches</Text>
      <Text> | </Text>
      <Text>{stats.fetchCount} pages</Text>
      <Text> | </Text>
      <Text>{stats.totalTokens.toLocaleString()} tokens</Text>
      <Text> | </Text>
      <Text>{elapsedSec}s</Text>
    </Box>
  );
}
