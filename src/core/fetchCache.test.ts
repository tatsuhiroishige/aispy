import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFetchCache } from './fetchCache.js';

describe('createFetchCache', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('set then get returns cached content and full markdown', () => {
    const cache = createFetchCache();
    cache.set('https://example.com', 'terminal-body', 'full-markdown', 'PROLOGUE');

    const entry = cache.get('https://example.com');
    expect(entry).toBeDefined();
    expect(entry?.content).toBe('terminal-body');
    expect(entry?.fullMarkdown).toBe('full-markdown');
    expect(entry?.imagePrologue).toBe('PROLOGUE');
  });

  it('get returns undefined for unknown URL', () => {
    const cache = createFetchCache();
    expect(cache.get('https://unknown.com')).toBeUndefined();
  });

  it('expired entries return undefined', () => {
    const ttlMs = 5000;
    const cache = createFetchCache(200, ttlMs);
    cache.set('https://example.com', 'content', 'md');

    expect(cache.get('https://example.com')).toBeDefined();

    vi.advanceTimersByTime(ttlMs);

    expect(cache.get('https://example.com')).toBeUndefined();
  });

  it('evicts oldest entry when at maxEntries', () => {
    const cache = createFetchCache(2);
    cache.set('https://a.com', 'a', 'md-a');
    cache.set('https://b.com', 'b', 'md-b');
    cache.set('https://c.com', 'c', 'md-c');

    expect(cache.get('https://a.com')).toBeUndefined();
    expect(cache.get('https://b.com')).toBeDefined();
    expect(cache.get('https://c.com')).toBeDefined();
    expect(cache.size()).toBe(2);
  });

  it('has returns true for cached and false for missing', () => {
    const cache = createFetchCache();
    cache.set('https://example.com', 'x', 'md');

    expect(cache.has('https://example.com')).toBe(true);
    expect(cache.has('https://missing.com')).toBe(false);
  });

  it('clear removes all entries', () => {
    const cache = createFetchCache();
    cache.set('https://a.com', 'a', 'md-a');
    cache.set('https://b.com', 'b', 'md-b');

    expect(cache.size()).toBe(2);
    cache.clear();
    expect(cache.size()).toBe(0);
    expect(cache.get('https://a.com')).toBeUndefined();
  });
});
