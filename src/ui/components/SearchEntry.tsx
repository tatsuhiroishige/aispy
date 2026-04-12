import { Box, Text } from 'ink';
import type { SearchEvent } from '../../types.js';
import { formatTime } from '../formatTime.js';

interface SearchEntryProps {
  event: SearchEvent;
  selected: boolean;
  fetchedUrls: ReadonlySet<string>;
}

export function SearchEntry({ event, selected, fetchedUrls }: SearchEntryProps) {
  return (
    <Box flexDirection="column">
      <Text bold={selected} color={selected ? 'cyan' : undefined}>
        [{formatTime(event.timestamp)}] Search: &quot;{event.query}&quot;
      </Text>
      {event.results.map((result, i) => {
        const wasRead = fetchedUrls.has(result.url);
        return (
          <Text key={result.url} dimColor={!selected && !wasRead}>
            {'  '}{i + 1}. {result.title} {wasRead
              ? <Text color="green">{'\u2190 read'}</Text>
              : <Text dimColor>{'\u2190 skip'}</Text>}
          </Text>
        );
      })}
    </Box>
  );
}
