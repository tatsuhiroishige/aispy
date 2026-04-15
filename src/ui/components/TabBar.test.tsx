import { describe, it, expect, beforeEach } from 'vitest';
import { render } from 'ink-testing-library';
import { TabBar } from './TabBar.js';
import { addTab, createTabCollection, resetTabIds } from '../../browser/tabs.js';

describe('TabBar', () => {
  beforeEach(() => resetTabIds());

  it('shows placeholder when no tabs', () => {
    const { lastFrame } = render(<TabBar tabs={[]} activeIndex={-1} />);
    expect(lastFrame()).toContain('no tabs');
  });

  it('lists tabs with their titles and active marker', () => {
    let tc = createTabCollection();
    tc = addTab(tc, { url: 'https://a.com', title: 'Alpha', content: '' });
    tc = addTab(tc, { url: 'https://b.com', title: 'Beta', content: '' });
    const { lastFrame } = render(<TabBar tabs={tc.tabs} activeIndex={tc.activeIndex} />);
    expect(lastFrame()).toContain('Alpha');
    expect(lastFrame()).toContain('Beta');
    expect(lastFrame()).toContain('[*2]');
    expect(lastFrame()).toContain('[ 1]');
  });

  it('truncates long titles', () => {
    let tc = createTabCollection();
    tc = addTab(tc, {
      url: 'https://x.com',
      title: 'Very long title that should be truncated',
      content: '',
    });
    const { lastFrame } = render(
      <TabBar tabs={tc.tabs} activeIndex={tc.activeIndex} maxLabelWidth={10} />,
    );
    expect(lastFrame()).toContain('…');
  });
});
