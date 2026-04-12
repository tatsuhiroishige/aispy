import { Text } from 'ink';
import type { FetchEvent, FetchStartEvent } from '../../types.js';
import { formatTime } from '../formatTime.js';

interface FetchEntryProps {
  event: FetchEvent | FetchStartEvent;
  selected: boolean;
}

export function FetchEntry({ event, selected }: FetchEntryProps) {
  if (event.type === 'fetch-start') {
    return (
      <Text bold={selected} color={selected ? 'cyan' : 'yellow'}>
        [{formatTime(event.timestamp)}] Fetching: {event.url}...
      </Text>
    );
  }

  const durationSec = (event.durationMs / 1000).toFixed(1);
  return (
    <Text bold={selected} color={selected ? 'cyan' : undefined}>
      [{formatTime(event.timestamp)}] Fetched: {event.url} ({event.tokens.toLocaleString()} tokens, {durationSec}s)
    </Text>
  );
}
