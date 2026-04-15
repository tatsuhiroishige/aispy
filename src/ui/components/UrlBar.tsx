import { Box, Text } from 'ink';

interface UrlBarProps {
  url: string | null;
  loading?: boolean;
  loadError?: string;
  canBack?: boolean;
  canForward?: boolean;
  editing?: boolean;
  draft?: string;
}

export function UrlBar({
  url,
  loading = false,
  loadError,
  canBack = false,
  canForward = false,
  editing = false,
  draft = '',
}: UrlBarProps) {
  if (editing) {
    return (
      <Box>
        <Text color="yellow">g </Text>
        <Text bold>URL › </Text>
        <Text>{draft}</Text>
        <Text color="gray">_</Text>
      </Box>
    );
  }

  const backArrow = canBack ? '◀' : '·';
  const forwardArrow = canForward ? '▶' : '·';
  const status = loading
    ? '◌ loading'
    : loadError
      ? `✗ ${loadError}`
      : url
        ? '● '
        : '';
  const displayUrl = url ?? '(no tab — press g to enter URL)';

  return (
    <Box>
      <Text color="cyan">
        {backArrow} {forwardArrow}{' '}
      </Text>
      <Text color={loadError ? 'red' : 'green'}>{status}</Text>
      <Text bold>{displayUrl}</Text>
    </Box>
  );
}
