import { describe, it, expect, vi } from 'vitest';
import { createEventStore } from './store.js';
import type { AispyEvent } from '../types.js';
import type { SearchEvent, FetchEvent, FetchStartEvent } from '../types.js';

function makeSearchEvent(overrides?: Partial<SearchEvent>): SearchEvent {
  return {
    type: 'search',
    timestamp: Date.now(),
    query: 'test query',
    count: 1,
    results: [{ title: 'Test', url: 'https://example.com', snippet: 'A snippet' }],
    ...overrides,
  };
}

function makeFetchEvent(overrides?: Partial<FetchEvent>): FetchEvent {
  return {
    type: 'fetch',
    timestamp: Date.now(),
    url: 'https://example.com',
    content: 'page content',
    tokens: 42,
    durationMs: 100,
    ...overrides,
  };
}

function makeFetchStartEvent(overrides?: Partial<FetchStartEvent>): FetchStartEvent {
  return {
    type: 'fetch-start',
    timestamp: Date.now(),
    url: 'https://example.com',
    ...overrides,
  };
}

describe('EventStore', () => {
  it('fresh store has empty events and zero stats', () => {
    const store = createEventStore();
    expect(store.getEvents()).toEqual([]);
    const stats = store.getStats();
    expect(stats.searchCount).toBe(0);
    expect(stats.fetchCount).toBe(0);
    expect(stats.totalTokens).toBe(0);
    expect(stats.elapsedMs).toBe(0);
  });

  it('addEvent with a SearchEvent returns it in getEvents and increments searchCount', () => {
    const store = createEventStore();
    const event = makeSearchEvent();
    store.addEvent(event);
    expect(store.getEvents()).toEqual([event]);
    expect(store.getStats().searchCount).toBe(1);
    expect(store.getStats().fetchCount).toBe(0);
  });

  it('addEvent with a FetchEvent shows fetchCount and totalTokens', () => {
    const store = createEventStore();
    const event = makeFetchEvent({ tokens: 150 });
    store.addEvent(event);
    const stats = store.getStats();
    expect(stats.fetchCount).toBe(1);
    expect(stats.totalTokens).toBe(150);
    expect(stats.searchCount).toBe(0);
  });

  it('subscribe callback fires on addEvent; unsubscribe stops it', () => {
    const store = createEventStore();
    const cb = vi.fn();
    const unsubscribe = store.subscribe(cb);

    const event1 = makeSearchEvent();
    store.addEvent(event1);
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith(event1);

    unsubscribe();

    const event2 = makeSearchEvent();
    store.addEvent(event2);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('multiple subscribers all receive events', () => {
    const store = createEventStore();
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    store.subscribe(cb1);
    store.subscribe(cb2);

    const event = makeFetchEvent();
    store.addEvent(event);

    expect(cb1).toHaveBeenCalledTimes(1);
    expect(cb1).toHaveBeenCalledWith(event);
    expect(cb2).toHaveBeenCalledTimes(1);
    expect(cb2).toHaveBeenCalledWith(event);
  });

  it('caps at 1000 events, dropping the oldest', () => {
    const store = createEventStore();
    const events: AispyEvent[] = [];
    for (let i = 0; i < 1001; i++) {
      const event = makeSearchEvent({ timestamp: i, query: `q${i}` });
      events.push(event);
      store.addEvent(event);
    }

    const stored = store.getEvents();
    expect(stored.length).toBe(1000);
    expect(stored[0]).toEqual(events[1]);
  });

  it('FetchStartEvent does not increment fetchCount or totalTokens', () => {
    const store = createEventStore();
    store.addEvent(makeFetchStartEvent());
    const stats = store.getStats();
    expect(stats.fetchCount).toBe(0);
    expect(stats.totalTokens).toBe(0);
  });
});
