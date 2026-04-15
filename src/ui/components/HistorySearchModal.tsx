import { Box, Text } from 'ink';
import type { HistoryItem } from '../../browser/historySearch.js';

interface HistorySearchModalProps {
  query: string;
  results: readonly HistoryItem[];
  selectedIndex: number;
  height: number;
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, Math.max(1, max - 1)) + '…';
}

export function HistorySearchModal({
  query,
  results,
  selectedIndex,
  height,
}: HistorySearchModalProps) {
  const visible = Math.max(1, height - 3);
  const start = Math.max(0, Math.min(selectedIndex, results.length - 1) - visible + 1);
  const shown = results.slice(start, start + visible);

  return (
    <Box flexDirection="column" borderStyle="double" borderColor="magenta" paddingX={1}>
      <Box>
        <Text color="magenta" bold>
          Ctrl-R › {query}
        </Text>
        <Text color="gray"> ({results.length} matches — ↑↓ select, Enter open, Esc cancel)</Text>
      </Box>
      {shown.length === 0 ? (
        <Text dimColor>(no matches)</Text>
      ) : (
        shown.map((item, i) => {
          const idx = start + i;
          const selected = idx === selectedIndex;
          const marker = item.source === 'bookmark' ? '★' : ' ';
          return (
            <Box key={`${item.url}-${idx}`}>
              <Text color={selected ? 'black' : 'yellow'} backgroundColor={selected ? 'cyan' : undefined}>
                {marker} {truncate(item.title, 30).padEnd(30)}
              </Text>
              <Text color={selected ? 'black' : 'gray'} backgroundColor={selected ? 'cyan' : undefined}>
                {' '}
                {truncate(item.url, 60)}
              </Text>
            </Box>
          );
        })
      )}
    </Box>
  );
}
