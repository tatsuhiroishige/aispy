import { Box, Text } from 'ink';
import type { SearchEvent } from '../../types.js';
import { formatTime } from '../formatTime.js';

interface SearchEntryProps {
  event: SearchEvent;
  selected: boolean;
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
