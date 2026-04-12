import { describe, it, expect } from 'vitest';
import { act } from 'react';
import { render } from 'ink-testing-library';
import { createEventStore } from '../core/store.js';
import { App } from './App.js';
import type { SearchEvent, FetchEvent } from '../types.js';

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
    tokens: 500,
    durationMs: 1200,
    ...overrides,
  };
}

describe('App', () => {
  it('renders without crashing with an empty store', () => {
    const store = createEventStore();
    const { lastFrame } = render(<App store={store} />);
    const frame = lastFrame()!;

    expect(frame).toContain('Waiting for events');
    expect(frame).toContain('No page selected');
    expect(frame).toContain('connected');
  });

  it('after addEvent(SearchEvent), ActivityLog shows the query', () => {
    const store = createEventStore();
    const { lastFrame } = render(<App store={store} />);

    act(() => {
      store.addEvent(makeSearchEvent({ query: 'lambda 1405' }));
    });
    const frame = lastFrame()!;

    expect(frame).toContain('lambda');
    expect(frame).toContain('1405');
  });

  it('StatusBar shows updated stats', () => {
    const store = createEventStore();
    const { lastFrame } = render(<App store={store} />);

    act(() => {
      store.addEvent(makeSearchEvent());
      store.addEvent(makeFetchEvent({ tokens: 8241 }));
    });

    const frame = lastFrame()!;
    expect(frame).toContain('1 searches');
    expect(frame).toContain('1 pages');
    expect(frame).toContain('8,241 tokens');
  });
});
