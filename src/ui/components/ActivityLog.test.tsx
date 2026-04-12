import { describe, it, expect } from 'vitest';
import { render } from 'ink-testing-library';
import { ActivityLog } from './ActivityLog.js';
import type { AispyEvent, SearchEvent, FetchEvent } from '../../types.js';

function makeSearchEvent(overrides?: Partial<SearchEvent>): SearchEvent {
  return {
    type: 'search',
    timestamp: Date.now(),
    query: 'test query',
    count: 1,
    results: [{ title: 'Test Result', url: 'https://example.com', snippet: 'A snippet' }],
    ...overrides,
  };
}

function makeFetchEvent(overrides?: Partial<FetchEvent>): FetchEvent {
  return {
    type: 'fetch',
    timestamp: Date.now(),
    url: 'https://example.com/page',
    content: 'page content',
    tokens: 42,
    durationMs: 100,
    ...overrides,
  };
}

describe('ActivityLog', () => {
  it('renders empty state', () => {
    const { lastFrame } = render(
      <ActivityLog events={[]} selectedIndex={0} focused={true} height={10} />,
    );
    const frame = lastFrame()!;
    expect(frame).toContain('Waiting for events');
  });

  it('renders 2 entries', () => {
    const events: AispyEvent[] = [makeSearchEvent(), makeFetchEvent()];
    const { lastFrame } = render(
      <ActivityLog events={events} selectedIndex={0} focused={true} height={20} />,
    );
    const frame = lastFrame()!;

    expect(frame).toContain('Q:');
    expect(frame).toContain('test query');
    expect(frame).toContain('example.com');
  });
});
