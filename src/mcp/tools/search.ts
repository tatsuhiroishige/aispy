import type { Tool, CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import axios from 'axios';
import { z } from 'zod';
import type { IpcClient } from '../../ipc/client.js';
import type { SearchResult } from '../../types.js';
import { loadConfig } from '../../config.js';

export const searchInputSchema = z.object({
  query: z.string().min(1),
  count: z.number().int().optional(),
});

export type SearchInput = z.infer<typeof searchInputSchema>;

export const searchTool: Tool = {
  name: 'search',
  description: 'Search the web and return results with titles and URLs',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search query' },
      count: { type: 'number', description: 'Max results', default: 10 },
    },
    required: ['query'],
  },
};

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

const DEFAULT_COUNT = 10;
const MIN_COUNT = 1;
const MAX_COUNT = 20;

export async function handleSearch(
  args: SearchInput,
  client?: IpcClient,
): Promise<CallToolResult> {
  const { braveApiKey } = loadConfig();
  const rawCount = args.count ?? DEFAULT_COUNT;
  const count = Math.min(MAX_COUNT, Math.max(MIN_COUNT, Math.trunc(rawCount)));

  try {
    const response = await axios.get<BraveSearchResponse>(
      'https://api.search.brave.com/res/v1/web/search',
      {
        params: { q: args.query, count },
        headers: {
          'X-Subscription-Token': braveApiKey,
          Accept: 'application/json',
        },
      },
    );

    const rawResults = response.data.web?.results ?? [];
    const results: SearchResult[] = rawResults.map((r) => ({
      title: r.title ?? '',
      url: r.url ?? '',
      snippet: r.description ?? '',
    }));

    let log = `[search] query: ${args.query}\n`;
    results.forEach((r, i) => {
      log += `[search]   ${i + 1}. ${r.title}\n`;
      log += `[search]      ${r.url}\n`;
    });
    process.stderr.write(log);

    client?.send({
      type: 'search',
      timestamp: Date.now(),
      query: args.query,
      count,
      results,
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(results, null, 2),
        },
      ],
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`[search] error: ${message}\n`);
    return {
      isError: true,
      content: [
        {
          type: 'text',
          text: `search failed: ${message}`,
        },
      ],
    };
  }
}
