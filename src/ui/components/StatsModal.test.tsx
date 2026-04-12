import { describe, it, expect } from 'vitest';
import { render } from 'ink-testing-library';
import { StatsModal } from './StatsModal.js';
import type { AispyEvent } from '../../types.js';
import type { SessionStats } from '../../core/store.js';

function makeStats(overrides?: Partial<SessionStats>): SessionStats {
  return {
    searchCount: 0,
    fetchCount: 0,
    totalTokens: 0,
    startTime: Date.now(),
    elapsedMs: 0,
    ...overrides,
  };
}

describe('StatsModal', () => {
  it('renders search count and fetch count correctly', () => {
    const events: AispyEvent[] = [
      { type: 'search', timestamp: 1000, query: 'CLAS12 Lambda', count: 8, results: [] },
      { type: 'search', timestamp: 2000, query: 'sWeight sPlot', count: 5, results: [] },
      { type: 'fetch', timestamp: 3000, url: 'https://arxiv.org/paper', content: 'text', tokens: 2341, durationMs: 800 },
    ];
    const stats = makeStats({ searchCount: 2, fetchCount: 1, totalTokens: 2341, elapsedMs: 14200 });

    const { lastFrame } = render(<StatsModal events={events} stats={stats} />);
    const frame = lastFrame()!;

    expect(frame).toContain('Searches: 2');
    expect(frame).toContain('Pages fetched: 1');
    expect(frame).toContain('CLAS12 Lambda');
    expect(frame).toContain('sWeight sPlot');
    expect(frame).toContain('arxiv.org');
  });

  it('shows total tokens', () => {
    const events: AispyEvent[] = [
      { type: 'fetch', timestamp: 1000, url: 'https://example.com', content: 'c', tokens: 8241, durationMs: 500 },
    ];
    const stats = makeStats({ fetchCount: 1, totalTokens: 8241 });

    const { lastFrame } = render(<StatsModal events={events} stats={stats} />);
    const frame = lastFrame()!;

    expect(frame).toContain('Total tokens: 8,241');
  });
});
