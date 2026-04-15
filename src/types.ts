export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export interface FetchResult {
  url: string;
  content: string;
  tokens: number;
}

export interface SearchEvent {
  type: 'search';
  timestamp: number;
  query: string;
  count: number;
  results: SearchResult[];
}

export interface FetchStartEvent {
  type: 'fetch-start';
  timestamp: number;
  url: string;
}

export interface FetchEvent {
  type: 'fetch';
  timestamp: number;
  url: string;
  content: string;
  imagePrologue?: string;
  tokens: number;
  durationMs: number;
}

export interface FetchUpdateEvent {
  type: 'fetch-update';
  timestamp: number;
  url: string;
  content: string;
  imagePrologue?: string;
  decoded?: number;
  total?: number;
  phase: 'partial' | 'final';
}

export type AispyEvent =
  | SearchEvent
  | FetchStartEvent
  | FetchEvent
  | FetchUpdateEvent;
