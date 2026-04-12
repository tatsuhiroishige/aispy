import { Box, Text, useStdout } from 'ink';
import type { SearchEvent } from '../../types.js';
import { formatTime } from '../formatTime.js';

interface SearchEntryProps {
  event: SearchEvent;
  selected: boolean;
  fetchedUrls: ReadonlySet<string>;
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 1) + '\u2026';
}

export function SearchEntry({ event, selected, fetchedUrls }: SearchEntryProps) {
  const { stdout } = useStdout();
  const paneWidth = Math.floor((stdout.columns ?? 80) * 0.3) - 4;
  const titleMax = Math.max(10, paneWidth - 10);

  return (
    <Box flexDirection="column">
      <Text bold={selected} color={selected ? 'cyan' : undefined}>
        [{formatTime(event.timestamp)}] Q: {truncate(event.query, titleMax)}
      </Text>
      {event.results.map((result, i) => {
        const wasRead = fetchedUrls.has(result.url);
        const label = wasRead ? '\u2190r' : '\u2190s';
        const labelColor = wasRead ? 'green' : undefined;
        return (
          <Text key={result.url} dimColor={!selected && !wasRead}>
            {' '}{i + 1}.{truncate(result.title, titleMax - 5)} {labelColor ? '' : ''}<Text color={labelColor} dimColor={!wasRead}>{label}</Text>
          </Text>
        );
      })}
    </Box>
  );
}
