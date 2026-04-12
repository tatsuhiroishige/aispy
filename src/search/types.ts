import type { SearchResult } from '../types.js';

export interface SearchBackend {
  readonly name: string;
  search(query: string, count: number): Promise<SearchResult[]>;
}
