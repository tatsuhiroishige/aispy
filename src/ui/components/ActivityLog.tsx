import { useMemo } from 'react';
import { Box, Text } from 'ink';
import type { AispyEvent } from '../../types.js';
import { SearchEntry } from './SearchEntry.js';
import { FetchEntry } from './FetchEntry.js';

interface ActivityLogProps {
  events: readonly AispyEvent[];
  selectedIndex: number;
  focused: boolean;
  height: number;
}

export function ActivityLog({ events, selectedIndex, focused, height }: ActivityLogProps) {
  const fetchedUrls = useMemo(() => {
    const urls = new Set<string>();
    for (const event of events) {
      if (event.type === 'fetch') urls.add(event.url);
    }
    return urls;
  }, [events]);

  if (events.length === 0) {
    return (
      <Box
        flexDirection="column"
        borderStyle="single"
        borderColor={focused ? 'cyan' : 'gray'}
        height={height}
        width="100%"
      >
        <Text dimColor>Waiting for events...</Text>
      </Box>
    );
  }

  const visibleCount = Math.max(1, height - 2);
  const startIndex = Math.max(0, Math.min(selectedIndex, events.length - 1) - visibleCount + 1);
  const visibleEvents = events.slice(startIndex, startIndex + visibleCount);

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor={focused ? 'cyan' : 'gray'}
      height={height}
      width="100%"
      overflowY="hidden"
    >
      {visibleEvents.map((event, i) => {
        const actualIndex = startIndex + i;
        const isSelected = actualIndex === selectedIndex;

        if (event.type === 'search') {
          return <SearchEntry key={actualIndex} event={event} selected={isSelected} fetchedUrls={fetchedUrls} />;
        }
        return <FetchEntry key={actualIndex} event={event} selected={isSelected} />;
      })}
    </Box>
  );
}
