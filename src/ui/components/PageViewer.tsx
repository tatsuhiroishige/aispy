import { Box, Text } from 'ink';
import type { ViewerState } from '../types.js';

interface PageViewerProps {
  viewer: ViewerState | null;
  focused: boolean;
  height: number;
}

export function PageViewer({ viewer, focused, height }: PageViewerProps) {
  if (!viewer) {
    return (
      <Box
        flexDirection="column"
        borderStyle="single"
        borderColor={focused ? 'cyan' : 'gray'}
        height={height}
        width="100%"
      >
        <Text dimColor>No page selected. Press Enter on a log entry.</Text>
      </Box>
    );
  }

  const lines = viewer.content.split('\n');
  const visibleCount = Math.max(1, height - 4);
  const visibleLines = lines.slice(viewer.scrollOffset, viewer.scrollOffset + visibleCount);

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor={focused ? 'cyan' : 'gray'}
      height={height}
      width="100%"
      overflowY="hidden"
    >
      <Text bold color="cyan">{viewer.url}</Text>
      <Text>{'─'.repeat(40)}</Text>
      {visibleLines.map((line, i) => (
        <Text key={viewer.scrollOffset + i}>{line}</Text>
      ))}
    </Box>
  );
}
