import axios from 'axios';
import type { SearchResult } from '../types.js';
import type { SearchBackend } from './types.js';

interface TavilyResult {
  title?: string;
  url?: string;
  content?: string;
}

interface TavilySearchResponse {
  results?: TavilyResult[];
}

export function createTavilyBackend(apiKey: string): SearchBackend {
  return {
    name: 'tavily',
    async search(query: string, count: number): Promise<SearchResult[]> {
      const response = await axios.post<TavilySearchResponse>(
        'https://api.tavily.com/search',
        {
          api_key: apiKey,
          query,
          max_results: count,
          search_depth: 'basic',
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );

      const rawResults = response.data.results ?? [];
      return rawResults.map((r) => ({
        title: r.title ?? '',
        url: r.url ?? '',
        snippet: r.content ?? '',
      }));
    },
  };
}
