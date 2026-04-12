import { describe, it, expect } from 'vitest';
import {
  serializeEvent,
  deserializeEvent,
  getSocketPath,
} from './protocol.js';
import type { AispyEvent } from '../types.js';
import os from 'node:os';

describe('protocol', () => {
  const searchEvent: AispyEvent = {
    type: 'search',
    timestamp: 1712000000000,
    query: 'vitest testing',
    count: 2,
    results: [
      { title: 'Vitest Docs', url: 'https://vitest.dev', snippet: 'Fast testing' },
      { title: 'Guide', url: 'https://example.com', snippet: 'A guide' },
    ],
  };

  const fetchStartEvent: AispyEvent = {
    type: 'fetch-start',
    timestamp: 1712000001000,
    url: 'https://vitest.dev',
  };

  const fetchEvent: AispyEvent = {
    type: 'fetch',
    timestamp: 1712000002000,
    url: 'https://vitest.dev',
    content: 'Vitest is a fast unit test framework.',
    tokens: 42,
    durationMs: 350,
  };

  describe('serializeEvent / deserializeEvent roundtrip', () => {
    it('roundtrips SearchEvent', () => {
      const line = serializeEvent(searchEvent);
      const result = deserializeEvent(line.trim());
      expect(result).toEqual(searchEvent);
    });

    it('roundtrips FetchStartEvent', () => {
      const line = serializeEvent(fetchStartEvent);
      const result = deserializeEvent(line.trim());
      expect(result).toEqual(fetchStartEvent);
    });

    it('roundtrips FetchEvent', () => {
      const line = serializeEvent(fetchEvent);
      const result = deserializeEvent(line.trim());
      expect(result).toEqual(fetchEvent);
    });
  });

  describe('deserializeEvent error handling', () => {
    it('throws on invalid JSON', () => {
      expect(() => deserializeEvent('not json')).toThrow();
    });

    it('throws on valid JSON but wrong shape', () => {
      expect(() => deserializeEvent('{"type":"unknown","data":1}')).toThrow();
    });
  });

  describe('getSocketPath', () => {
    it('returns a string containing username and ending in .sock', () => {
      const socketPath = getSocketPath();
      const username = os.userInfo().username;
      expect(socketPath).toContain(username);
      expect(socketPath).toMatch(/\.sock$/);
    });
  });

  describe('serializeEvent format', () => {
    it('serialized output ends with newline', () => {
      const line = serializeEvent(searchEvent);
      expect(line).toMatch(/\n$/);
    });
  });
});
