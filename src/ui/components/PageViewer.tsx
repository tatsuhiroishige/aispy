import React from 'react';
import { Box, Text } from 'ink';
import type { ViewerState } from '../types.js';

interface PageViewerProps {
  viewer: ViewerState | null;
  focused: boolean;
  height: number;
}

const LINK_RE = /\[([^\]]+)\]\(([^)]+)\)/g;
const HEADING_RE = /^#{1,6}\s/;
const HR_RE = /^(---+|___+|\*\*\*+)\s*$/;
const CODE_FENCE_RE = /^```/;

function renderInlineLinks(line: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  LINK_RE.lastIndex = 0;
  while ((match = LINK_RE.exec(line)) !== null) {
    if (match.index > lastIndex) {
      parts.push(<Text key={`t${lastIndex}`}>{line.slice(lastIndex, match.index)}</Text>);
    }
    parts.push(<Text key={`l${match.index}`} color="blue" underline>{match[1]}</Text>);
    parts.push(<Text key={`u${match.index}`} dimColor>({match[2]})</Text>);
    lastIndex = LINK_RE.lastIndex;
  }

  if (parts.length === 0) {
    return <Text>{line}</Text>;
  }

  if (lastIndex < line.length) {
    parts.push(<Text key={`t${lastIndex}`}>{line.slice(lastIndex)}</Text>);
  }

  return <Text>{parts}</Text>;
}

function renderMarkdownLine(line: string, inCodeBlock: boolean): React.ReactNode {
  if (CODE_FENCE_RE.test(line)) {
    return <Text color="yellow">{line}</Text>;
  }

  if (inCodeBlock) {
    return <Text color="yellow">{line}</Text>;
  }

  if (HEADING_RE.test(line)) {
    return <Text bold color="cyan">{line}</Text>;
  }

  if (HR_RE.test(line)) {
    return <Text dimColor>{line}</Text>;
  }

  if (LINK_RE.test(line)) {
    return renderInlineLinks(line);
  }

  return <Text>{line}</Text>;
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

  let inCodeBlock = false;
  for (let i = 0; i < viewer.scrollOffset; i++) {
    if (CODE_FENCE_RE.test(lines[i]!)) {
      inCodeBlock = !inCodeBlock;
    }
  }

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
      {visibleLines.map((line, i) => {
        const isCodeFence = CODE_FENCE_RE.test(line);
        if (isCodeFence) {
          const node = renderMarkdownLine(line, inCodeBlock);
          inCodeBlock = !inCodeBlock;
          return <React.Fragment key={viewer.scrollOffset + i}>{node}</React.Fragment>;
        }
        const node = renderMarkdownLine(line, inCodeBlock);
        return <React.Fragment key={viewer.scrollOffset + i}>{node}</React.Fragment>;
      })}
    </Box>
  );
}
