import { Box, Text } from 'ink';
import type { LinkHint } from '../../browser/linkHints.js';

interface LinkHintsModalProps {
  hints: LinkHint[];
  prefix: string;
  height: number;
}

export function LinkHintsModal({ hints, prefix, height }: LinkHintsModalProps) {
  const visible = Math.max(1, height - 4);
  const matching = prefix ? hints.filter((h) => h.label.startsWith(prefix)) : hints;
  const shown = matching.slice(0, visible);

  return (
    <Box
      flexDirection="column"
      borderStyle="double"
      borderColor="yellow"
      paddingX={1}
    >
      <Text bold color="yellow">
        Links (type label, Esc to cancel) — {matching.length}/{hints.length}
        {prefix ? `  [${prefix}…]` : ''}
      </Text>
      {shown.length === 0 ? (
        <Text dimColor>(no links on this page)</Text>
      ) : (
        shown.map((h) => (
          <Box key={h.label}>
            <Text color="yellow" bold>
              {h.label.padEnd(3)}
            </Text>
            <Text>{' '}</Text>
            <Text>{h.text.slice(0, 40).padEnd(40)}</Text>
            <Text dimColor>
              {' '}
              {h.url.length > 50 ? h.url.slice(0, 47) + '…' : h.url}
            </Text>
          </Box>
        ))
      )}
      {matching.length > visible && (
        <Text dimColor>+ {matching.length - visible} more</Text>
      )}
    </Box>
  );
}
