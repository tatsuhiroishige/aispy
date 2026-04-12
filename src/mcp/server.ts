import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type CallToolResult,
} from '@modelcontextprotocol/sdk/types.js';
import type { ZodType } from 'zod';
import type { IpcClient } from '../ipc/client.js';
import {
  fetchInputSchema,
  fetchTool,
  handleFetch,
} from './tools/fetch.js';
import {
  handleSearch,
  searchInputSchema,
  searchTool,
} from './tools/search.js';

function invalidArgsResult(toolName: string, message: string): CallToolResult {
  return {
    isError: true,
    content: [
      {
        type: 'text',
        text: `invalid arguments for ${toolName}: ${message}`,
      },
    ],
  };
}

function parseOrError<T>(
  schema: ZodType<T>,
  toolName: string,
  args: unknown,
): { ok: true; data: T } | { ok: false; result: CallToolResult } {
  const parsed = schema.safeParse(args);
  if (!parsed.success) {
    return { ok: false, result: invalidArgsResult(toolName, parsed.error.message) };
  }
  return { ok: true, data: parsed.data };
}

export function createServer(client?: IpcClient): Server {
  const server = new Server(
    { name: 'aispy', version: '0.0.0' },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, () => {
    return { tools: [searchTool, fetchTool] };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    switch (name) {
      case 'search': {
        const parsed = parseOrError(searchInputSchema, 'search', args);
        if (!parsed.ok) return parsed.result;
        return handleSearch(parsed.data, client);
      }
      case 'fetch': {
        const parsed = parseOrError(fetchInputSchema, 'fetch', args);
        if (!parsed.ok) return parsed.result;
        return handleFetch(parsed.data, client);
      }
      default:
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: `unknown tool: ${name}`,
            },
          ],
        };
    }
  });

  return server;
}
