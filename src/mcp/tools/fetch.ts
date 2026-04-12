import type { Tool, CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import axios from 'axios';
import { z } from 'zod';
import type { FetchCache } from '../../core/fetchCache.js';
import { htmlToText } from '../../core/htmlToText.js';
import type { IpcClient } from '../../ipc/client.js';

export const fetchInputSchema = z.object({
  url: z.string().url(),
  prompt: z.string().optional(),
});

export type FetchInput = z.infer<typeof fetchInputSchema>;

export const fetchTool: Tool = {
  name: 'fetch',
  description: 'Fetch a web page and return its text content',
  inputSchema: {
    type: 'object',
    properties: {
      url: { type: 'string', description: 'URL to fetch' },
      prompt: {
        type: 'string',
        description: 'What to extract from the page',
      },
    },
    required: ['url'],
  },
};

const REQUEST_TIMEOUT_MS = 15_000;
const PREVIEW_CHARS = 200;
const CHARS_PER_TOKEN = 4;

export async function handleFetch(
  args: FetchInput,
  client?: IpcClient,
  cache?: FetchCache,
): Promise<CallToolResult> {
  try {
    const cached = cache?.get(args.url);
    if (cached) {
      client?.send({
        type: 'fetch',
        timestamp: Date.now(),
        url: args.url,
        content: cached.content,
        tokens: cached.tokens,
        durationMs: 0,
      });
      process.stderr.write(`[fetch] cache hit: ${args.url}\n`);
      return { content: [{ type: 'text', text: cached.content }] };
    }

    const startTime = Date.now();

    client?.send({
      type: 'fetch-start',
      timestamp: Date.now(),
      url: args.url,
    });

    const response = await axios.get<string>(args.url, {
      responseType: 'text',
      timeout: REQUEST_TIMEOUT_MS,
    });

    let content = await htmlToText(response.data, args.url);

    const MAX_CONTENT_CHARS = 50_000;
    if (content.length > MAX_CONTENT_CHARS) {
      content = content.slice(0, MAX_CONTENT_CHARS) + '\n\n[Content truncated at 50,000 characters]';
    }

    const tokens = Math.ceil(content.length / CHARS_PER_TOKEN);
    const preview = content.slice(0, PREVIEW_CHARS);

    let log = `[fetch] url: ${args.url}\n`;
    log += `[fetch]   tokens: ${tokens}\n`;
    log += `[fetch]   preview: ${preview}\n`;
    process.stderr.write(log);

    client?.send({
      type: 'fetch',
      timestamp: Date.now(),
      url: args.url,
      content,
      tokens,
      durationMs: Date.now() - startTime,
    });

    cache?.set(args.url, content, tokens);

    return {
      content: [
        {
          type: 'text',
          text: content,
        },
      ],
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`[fetch] error: ${message}\n`);
    return {
      isError: true,
      content: [
        {
          type: 'text',
          text: `fetch failed: ${message}`,
        },
      ],
    };
  }
}
