import { useEffect, useMemo, useRef } from 'react';
import { Box, Text } from 'ink';
import type { ViewerState } from '../types.js';

interface PageViewerProps {
  viewer: ViewerState | null;
  focused: boolean;
  height: number;
  imagePrologue?: string;
}

export function PageViewer({ viewer, focused, height, imagePrologue }: PageViewerProps) {
  const lines = useMemo(
    () => (viewer ? viewer.content.split('\n') : []),
    [viewer?.content],
  );

  const lastEmittedRef = useRef<string | null>(null);

  // Emit the Kitty virtual-upload APC sequences directly to stdout (Ink's text
  // pipeline strips/mangles APC, so placeholder cells alone wouldn't render
  // images). Re-emit only when the prologue actually changes (new tab/page).
  useEffect(() => {
    if (!imagePrologue || imagePrologue === lastEmittedRef.current) return;
    lastEmittedRef.current = imagePrologue;
    process.stdout.write(imagePrologue);
  }, [imagePrologue]);

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

  const visibleCount = Math.max(1, height - 4);
  const start = Math.min(viewer.scrollOffset, Math.max(0, lines.length - 1));
  const visibleLines = lines.slice(start, start + visibleCount);

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
        <Text key={start + i}>{line}</Text>
      ))}
    </Box>
  );
}
