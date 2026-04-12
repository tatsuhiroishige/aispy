import { Text, useStdout } from 'ink';
import type { FetchEvent, FetchStartEvent } from '../../types.js';
import { formatTime } from '../formatTime.js';

interface FetchEntryProps {
  event: FetchEvent | FetchStartEvent;
  selected: boolean;
}

function truncateUrl(url: string, maxLen: number): string {
  if (url.length <= maxLen) return url;
  const short = url.replace(/^https?:\/\//, '');
  if (short.length <= maxLen) return short;
  return short.slice(0, maxLen - 1) + '\u2026';
}

export function FetchEntry({ event, selected }: FetchEntryProps) {
  const { stdout } = useStdout();
  const paneWidth = Math.floor((stdout.columns ?? 80) * 0.3) - 4;
  const urlMax = Math.max(10, paneWidth - 14);

  if (event.type === 'fetch-start') {
    return (
      <Text bold={selected} color={selected ? 'cyan' : 'yellow'}>
        [{formatTime(event.timestamp)}] Fetch: {truncateUrl(event.url, urlMax)}...
      </Text>
    );
  }

  const durationSec = (event.durationMs / 1000).toFixed(1);
  return (
    <Text bold={selected} color={selected ? 'cyan' : undefined}>
      [{formatTime(event.timestamp)}] {truncateUrl(event.url, urlMax)} ({event.tokens}tok {durationSec}s)
    </Text>
  );
}
