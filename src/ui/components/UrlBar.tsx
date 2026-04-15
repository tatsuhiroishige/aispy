import { Box, Text } from 'ink';

interface UrlBarProps {
  url: string | null;
  loading?: boolean;
  loadError?: string;
  canBack?: boolean;
  canForward?: boolean;
  editing?: boolean;
  draft?: string;
  decodeProgress?: { decoded: number; total: number };
}

export function UrlBar({
  url,
  loading = false,
  loadError,
  canBack = false,
  canForward = false,
  editing = false,
  draft = '',
  decodeProgress,
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
  let status: string;
  if (loading) {
    status = decodeProgress
      ? `◌ images ${decodeProgress.decoded}/${decodeProgress.total} `
      : '◌ loading ';
  } else if (loadError) {
    status = `✗ ${loadError} `;
  } else if (url) {
    status = '● ';
  } else {
    status = '';
  }
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
