import axios from 'axios';
import type { SearchResult } from '../types.js';
import type { SearchBackend } from './types.js';

interface SerperOrganicResult {
  title?: string;
  link?: string;
  snippet?: string;
}

interface SerperSearchResponse {
  organic?: SerperOrganicResult[];
}

export function createSerperBackend(apiKey: string): SearchBackend {
  return {
    name: 'serper',
    async search(query: string, count: number): Promise<SearchResult[]> {
      const response = await axios.post<SerperSearchResponse>(
        'https://google.serper.dev/search',
        { q: query, num: count },
        {
          headers: {
            'X-API-KEY': apiKey,
            'Content-Type': 'application/json',
          },
        },
      );

      const rawResults = response.data.organic ?? [];
      return rawResults.map((r) => ({
        title: r.title ?? '',
        url: r.link ?? '',
        snippet: r.snippet ?? '',
      }));
    },
  };
}
