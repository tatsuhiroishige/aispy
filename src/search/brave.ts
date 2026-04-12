import axios from 'axios';
import type { SearchResult } from '../types.js';
import type { SearchBackend } from './types.js';

interface BraveWebResult {
  title?: string;
  url?: string;
  description?: string;
}

interface BraveSearchResponse {
  web?: {
    results?: BraveWebResult[];
  };
}

export function createBraveBackend(apiKey: string): SearchBackend {
  return {
    name: 'brave',
    async search(query: string, count: number): Promise<SearchResult[]> {
      const response = await axios.get<BraveSearchResponse>(
        'https://api.search.brave.com/res/v1/web/search',
        {
          params: { q: query, count },
          headers: {
            'X-Subscription-Token': apiKey,
            Accept: 'application/json',
          },
        },
      );

      const rawResults = response.data.web?.results ?? [];
      return rawResults.map((r) => ({
        title: r.title ?? '',
        url: r.url ?? '',
        snippet: r.description ?? '',
      }));
    },
  };
}
