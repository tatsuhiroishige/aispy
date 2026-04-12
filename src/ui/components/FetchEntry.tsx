import { Text } from 'ink';
import type { FetchEvent, FetchStartEvent } from '../../types.js';

interface FetchEntryProps {
  event: FetchEvent | FetchStartEvent;
  selected: boolean;
}

function formatTime(timestamp: number): string {
  const d = new Date(timestamp);
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  const s = String(d.getSeconds()).padStart(2, '0');
  return `${h}:${m}:${s}`;
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
