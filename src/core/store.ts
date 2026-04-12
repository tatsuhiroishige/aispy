import type { AispyEvent } from '../types.js';

export interface SessionStats {
  searchCount: number;
  fetchCount: number;
  totalTokens: number;
  startTime: number;
  elapsedMs: number;
}

export interface EventStore {
  addEvent(event: AispyEvent): void;
  subscribe(callback: (event: AispyEvent) => void): () => void;
  getEvents(): readonly AispyEvent[];
  getStats(): SessionStats;
}

// oldest dropped when exceeded
const MAX_EVENTS = 1000;

export function createEventStore(): EventStore {
  const events: AispyEvent[] = [];
  const listeners = new Set<(event: AispyEvent) => void>();

  return {
    addEvent(event: AispyEvent): void {
      events.push(event);
      if (events.length > MAX_EVENTS) {
        events.shift();
      }
      for (const cb of listeners) {
        cb(event);
      }
    },

    subscribe(callback: (event: AispyEvent) => void): () => void {
      listeners.add(callback);
      return () => {
        listeners.delete(callback);
      };
    },

    getEvents(): readonly AispyEvent[] {
      return [...events];
    },

    getStats(): SessionStats {
      const now = Date.now();
      if (events.length === 0) {
        return { searchCount: 0, fetchCount: 0, totalTokens: 0, startTime: now, elapsedMs: 0 };
      }

      let searchCount = 0;
      let fetchCount = 0;
      let totalTokens = 0;

      for (const event of events) {
        if (event.type === 'search') {
          searchCount++;
        } else if (event.type === 'fetch') {
          fetchCount++;
          totalTokens += event.tokens;
        }
      }

      const startTime = events[0]!.timestamp;
      return { searchCount, fetchCount, totalTokens, startTime, elapsedMs: now - startTime };
    },
  };
}
