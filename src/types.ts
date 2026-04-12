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
  tokens: number;
  durationMs: number;
}

export type AispyEvent = SearchEvent | FetchStartEvent | FetchEvent;
