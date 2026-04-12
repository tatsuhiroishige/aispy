import { useState, useEffect, useRef } from 'react';
import type { AispyEvent } from '../../types.js';
import type { SessionStats } from '../../core/store.js';
import { useStoreCtx } from '../contexts/StoreContext.js';

interface UseEventStoreResult {
  events: readonly AispyEvent[];
  stats: SessionStats;
}

/** Subscribes to EventStore and returns current events + stats. */
export function useEventStore(): UseEventStoreResult {
  const store = useStoreCtx();
  const [events, setEvents] = useState<readonly AispyEvent[]>(store.getEvents());
  const [stats, setStats] = useState<SessionStats>(store.getStats());
  const bufferRef = useRef<readonly AispyEvent[]>(store.getEvents());

  useEffect(() => {
    const unsubscribe = store.subscribe(() => {
      bufferRef.current = store.getEvents();
      setEvents(bufferRef.current);
      setStats(store.getStats());
    });
    return unsubscribe;
  }, [store]);

  return { events, stats };
}
