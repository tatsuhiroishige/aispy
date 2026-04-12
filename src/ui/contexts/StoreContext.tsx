import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import type { EventStore } from '../../core/store.js';

const StoreContext = createContext<EventStore | null>(null);

interface StoreProviderProps {
  store: EventStore;
  children: ReactNode;
}

export function StoreProvider({ store, children }: StoreProviderProps) {
  return <StoreContext value={store}>{children}</StoreContext>;
}

export function useStoreCtx(): EventStore {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('StoreProvider missing');
  return ctx;
}
