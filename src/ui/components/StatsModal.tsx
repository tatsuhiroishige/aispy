import { Box, Text } from 'ink';
import type { AispyEvent } from '../../types.js';
import type { SessionStats } from '../../core/store.js';

interface StatsModalProps {
  events: readonly AispyEvent[];
  stats: SessionStats;
}

export function StatsModal({ events, stats }: StatsModalProps) {
  const searches = events.filter((e) => e.type === 'search');
  const fetches = events.filter((e) => e.type === 'fetch');
  const elapsedSec = (stats.elapsedMs / 1000).toFixed(1);

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="cyan"
      paddingX={1}
    >
      <Text bold color="cyan">Session Stats</Text>
      <Text> </Text>

      <Text>Searches: {stats.searchCount}</Text>
      {searches.map((e, i) => {
        if (e.type !== 'search') return null;
        return (
          <Text key={i}>
            {'  '}{i + 1}. &quot;{e.query}&quot; → {e.count} results
          </Text>
        );
      })}

      <Text> </Text>
      <Text>Pages fetched: {stats.fetchCount}</Text>
      {fetches.map((e, i) => {
        if (e.type !== 'fetch') return null;
        return (
          <Text key={i}>
            {'  '}{i + 1}. {e.url} ({e.tokens.toLocaleString()} tok)
          </Text>
        );
      })}

      <Text> </Text>
      <Text>Total tokens: {stats.totalTokens.toLocaleString()}</Text>
      <Text>Session time: {elapsedSec}s</Text>
      <Text> </Text>
      <Text dimColor>[Escape] close</Text>
    </Box>
  );
}
