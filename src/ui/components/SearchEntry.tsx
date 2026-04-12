import { Box, Text } from 'ink';
import type { SearchEvent } from '../../types.js';

interface SearchEntryProps {
  event: SearchEvent;
  selected: boolean;
}

function formatTime(timestamp: number): string {
  const d = new Date(timestamp);
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  const s = String(d.getSeconds()).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

export function SearchEntry({ event, selected }: SearchEntryProps) {
  return (
    <Box flexDirection="column">
      <Text bold={selected} color={selected ? 'cyan' : undefined}>
        [{formatTime(event.timestamp)}] Search: &quot;{event.query}&quot;
      </Text>
      {event.results.map((result, i) => (
        <Box key={result.url} flexDirection="column" marginLeft={2}>
          <Text dimColor={!selected}>
            {i + 1}. {result.title}
          </Text>
          <Text dimColor color="gray">
            {'   '}{result.url}
          </Text>
        </Box>
      ))}
    </Box>
  );
}
