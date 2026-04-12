import { describe, it, expect } from 'vitest';
import { act } from 'react';
import { render } from 'ink-testing-library';
import { Text } from 'ink';
import { createEventStore } from '../../core/store.js';
import { StoreProvider } from '../contexts/StoreContext.js';
import { useEventStore } from './useEventStore.js';
import type { SearchEvent } from '../../types.js';

function makeSearchEvent(overrides?: Partial<SearchEvent>): SearchEvent {
  return {
    type: 'search',
    timestamp: Date.now(),
    query: 'test query',
    count: 1,
    results: [{ title: 'Test', url: 'https://example.com', snippet: 'snippet' }],
    ...overrides,
  };
}

function TestConsumer() {
  const { events, stats } = useEventStore();
  return (
    <Text>
      events:{events.length} searches:{stats.searchCount}
    </Text>
  );
}

describe('useEventStore', () => {
  it('returns events after addEvent', () => {
    const store = createEventStore();
    const { lastFrame } = render(
      <StoreProvider store={store}>
        <TestConsumer />
      </StoreProvider>,
    );

    expect(lastFrame()).toContain('events:0');
    expect(lastFrame()).toContain('searches:0');

    act(() => {
      store.addEvent(makeSearchEvent());
    });

    expect(lastFrame()).toContain('events:1');
    expect(lastFrame()).toContain('searches:1');
  });

  it('unsubscribes on unmount', () => {
    const store = createEventStore();
    const { unmount } = render(
      <StoreProvider store={store}>
        <TestConsumer />
      </StoreProvider>,
    );

    unmount();
    // Should not throw after unmount
    store.addEvent(makeSearchEvent());
  });
});
