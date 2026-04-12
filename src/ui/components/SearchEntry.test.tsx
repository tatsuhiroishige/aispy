import { describe, it, expect } from 'vitest';
import { render } from 'ink-testing-library';
import { SearchEntry } from './SearchEntry.js';
import type { SearchEvent } from '../../types.js';

function makeSearchEvent(overrides?: Partial<SearchEvent>): SearchEvent {
  return {
    type: 'search',
    timestamp: Date.now(),
    query: 'test query',
    count: 2,
    results: [
      { title: 'First Result', url: 'https://example.com/a', snippet: 'snippet a' },
      { title: 'Second Result', url: 'https://example.com/b', snippet: 'snippet b' },
    ],
    ...overrides,
  };
}

describe('SearchEntry', () => {
  it('shows skip for all results when no URLs fetched', () => {
    const { lastFrame } = render(
      <SearchEntry event={makeSearchEvent()} selected={false} fetchedUrls={new Set()} />,
    );
    const frame = lastFrame()!;

    expect(frame).toContain('First Result');
    expect(frame).toContain('Second Result');

    const skipCount = (frame.match(/← skip/g) ?? []).length;
    expect(skipCount).toBe(2);
    expect(frame).not.toContain('← read');
  });

  it('shows read for fetched URL and skip for others', () => {
    const fetchedUrls = new Set(['https://example.com/a']);
    const { lastFrame } = render(
      <SearchEntry event={makeSearchEvent()} selected={false} fetchedUrls={fetchedUrls} />,
    );
    const frame = lastFrame()!;

    const lines = frame.split('\n');
    const firstLine = lines.find((l) => l.includes('First Result'));
    const secondLine = lines.find((l) => l.includes('Second Result'));

    expect(firstLine).toContain('← read');
    expect(secondLine).toContain('← skip');
  });
});
