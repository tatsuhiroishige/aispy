import { Box, Text } from 'ink';
import type { Tab } from '../../browser/tabs.js';
import { currentEntry } from '../../browser/tabs.js';

interface TabBarProps {
  tabs: Tab[];
  activeIndex: number;
  maxLabelWidth?: number;
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, Math.max(1, max - 1)) + '…';
}

function tabLabel(tab: Tab, maxLabelWidth: number): string {
  const entry = currentEntry(tab);
  if (!entry) return '(empty)';
  const base = entry.title || entry.url;
  return truncate(base, maxLabelWidth);
}

export function TabBar({ tabs, activeIndex, maxLabelWidth = 20 }: TabBarProps) {
  if (tabs.length === 0) {
    return (
      <Box>
        <Text color="gray">no tabs — g to open URL, t for new tab</Text>
      </Box>
    );
  }

  return (
    <Box>
      {tabs.map((tab, i) => {
        const active = i === activeIndex;
        const marker = active ? '*' : ' ';
        const label = tabLabel(tab, maxLabelWidth);
        return (
          <Box key={tab.id} marginRight={1}>
            <Text color={active ? 'cyan' : 'gray'}>
              [{marker}{i + 1}] {label}
            </Text>
          </Box>
        );
      })}
    </Box>
  );
}
