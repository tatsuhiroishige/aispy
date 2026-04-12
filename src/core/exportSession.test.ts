import { describe, it, expect } from 'vitest';
import { exportToJson, exportToMarkdown } from './exportSession.js';
import type { AispyEvent, SearchEvent, FetchEvent } from '../types.js';
import type { SessionStats } from './store.js';

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

function makeSearchEvent(overrides?: Partial<SearchEvent>): SearchEvent {
  return {
    type: 'search',
    timestamp: Date.now(),
    query: 'test query',
    count: 2,
    results: [
      { title: 'Result A', url: 'https://a.example.com', snippet: 'snippet a' },
      { title: 'Result B', url: 'https://b.example.com', snippet: 'snippet b' },
    ],
    ...overrides,
  };
}

function makeFetchEvent(overrides?: Partial<FetchEvent>): FetchEvent {
  return {
    type: 'fetch',
    timestamp: Date.now(),
    url: 'https://example.com/page',
    content: 'page content here',
    tokens: 2341,
    durationMs: 1200,
    ...overrides,
  };
}

describe('exportToJson', () => {
  it('produces valid JSON with stats and events', () => {
    const events: AispyEvent[] = [
      makeSearchEvent({ query: 'CLAS12 Lambda' }),
      makeFetchEvent({ url: 'https://arxiv.org/paper', tokens: 5000 }),
    ];
    const stats = makeStats({ searchCount: 1, fetchCount: 1, totalTokens: 5000 });

    const json = exportToJson(events, stats);
    const parsed = JSON.parse(json);

    expect(parsed.exportedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
    expect(parsed.stats).toEqual({ searchCount: 1, fetchCount: 1, totalTokens: 5000 });
    expect(parsed.events).toHaveLength(2);
    expect(parsed.events[0].type).toBe('search');
    expect(parsed.events[0].query).toBe('CLAS12 Lambda');
    expect(parsed.events[1].type).toBe('fetch');
    expect(parsed.events[1].url).toBe('https://arxiv.org/paper');
  });

  it('produces valid JSON for empty events', () => {
    const json = exportToJson([], makeStats());
    const parsed = JSON.parse(json);

    expect(parsed.exportedAt).toBeDefined();
    expect(parsed.stats).toEqual({ searchCount: 0, fetchCount: 0, totalTokens: 0 });
    expect(parsed.events).toEqual([]);
  });
});

describe('exportToMarkdown', () => {
  it('contains search queries, fetch URLs, and stats', () => {
    const events: AispyEvent[] = [
      makeSearchEvent({ query: 'CLAS12 Lambda' }),
      makeFetchEvent({ url: 'https://arxiv.org/paper', tokens: 2341, durationMs: 1200 }),
    ];
    const stats = makeStats({ searchCount: 1, fetchCount: 1, totalTokens: 2341 });

    const md = exportToMarkdown(events, stats);

    expect(md).toContain('# aispy Session Export');
    expect(md).toContain('Searches: 1');
    expect(md).toContain('Pages: 1');
    expect(md).toContain('Tokens: 2,341');
    expect(md).toContain('Search: "CLAS12 Lambda"');
    expect(md).toContain('Result 1: Result A (https://a.example.com)');
    expect(md).toContain('Result 2: Result B (https://b.example.com)');
    expect(md).toContain('Fetch: https://arxiv.org/paper');
    expect(md).toContain('Tokens: 2,341 | Duration: 1.2s');
  });

  it('produces valid output for empty events', () => {
    const md = exportToMarkdown([], makeStats());

    expect(md).toContain('# aispy Session Export');
    expect(md).toContain('Searches: 0');
    expect(md).toContain('Pages: 0');
    expect(md).toContain('Tokens: 0');
    expect(md).toContain('## Activity Log');
  });
});
