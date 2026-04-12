import { Box, Text } from 'ink';

interface FilterInputProps {
  value: string;
  onChange(value: string): void;
}

export function FilterInput({ value }: FilterInputProps) {
  return (
    <Box>
      <Text color="yellow">/</Text>
      <Text>{value}</Text>
      <Text color="gray">_</Text>
    </Box>
  );
}
