import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./tools/search.js', async () => {
  const { z } = await import('zod');
  return {
    searchTool: {
      name: 'search',
      description: 'mock search',
      inputSchema: { type: 'object' },
    },
    searchInputSchema: z.object({
      query: z.string().min(1),
      count: z.number().int().optional(),
    }),
    handleSearch: vi
      .fn()
      .mockResolvedValue({ content: [{ type: 'text', text: 'search-result' }] }),
  };
});

vi.mock('./tools/fetch.js', async () => {
  const { z } = await import('zod');
  return {
    fetchTool: {
      name: 'fetch',
      description: 'mock fetch',
      inputSchema: { type: 'object' },
    },
    fetchInputSchema: z.object({
      url: z.string().url(),
      prompt: z.string().optional(),
    }),
    handleFetch: vi
      .fn()
      .mockResolvedValue({ content: [{ type: 'text', text: 'fetch-result' }] }),
  };
});

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { createServer } from './server.js';
import { handleFetch } from './tools/fetch.js';
import { handleSearch } from './tools/search.js';

// These tests drive the server through an in-memory transport pair plus
// an MCP Client, which is the simplest way to exercise registered request
// handlers without touching private SDK internals.
async function connectPair(): Promise<{ client: Client; server: Server }> {
  const server = createServer();
  const client = new Client(
    { name: 'test-client', version: '0.0.0' },
    { capabilities: {} },
  );
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport),
  ]);
  return { client, server };
}

describe('createServer', () => {
  beforeEach(() => {
    vi.mocked(handleSearch).mockClear();
    vi.mocked(handleFetch).mockClear();
  });

  it('returns a Server instance', () => {
    const server = createServer();
    expect(server).not.toBeNull();
    expect(server).toBeInstanceOf(Server);
  });

  it('lists both search and fetch tools', async () => {
    const { client } = await connectPair();
    const result = await client.listTools();
    const names = result.tools.map((t) => t.name);
    expect(names).toContain('search');
    expect(names).toContain('fetch');
  });

  it('dispatches search tool calls to handleSearch', async () => {
    const { client } = await connectPair();
    const result = await client.callTool({
      name: 'search',
      arguments: { query: 'hello' },
    });
    expect(handleSearch).toHaveBeenCalledTimes(1);
    expect(handleSearch).toHaveBeenCalledWith({ query: 'hello' }, undefined);
    expect(result.content).toEqual([{ type: 'text', text: 'search-result' }]);
  });

  it('dispatches fetch tool calls to handleFetch', async () => {
    const { client } = await connectPair();
    const result = await client.callTool({
      name: 'fetch',
      arguments: { url: 'https://example.com' },
    });
    expect(handleFetch).toHaveBeenCalledTimes(1);
    expect(handleFetch).toHaveBeenCalledWith({ url: 'https://example.com' }, undefined);
    expect(result.content).toEqual([{ type: 'text', text: 'fetch-result' }]);
  });

  it('returns an error result for unknown tool names', async () => {
    const { client } = await connectPair();
    const result = await client.callTool({
      name: 'nonexistent',
      arguments: {},
    });
    expect(result.isError).toBe(true);
    expect(handleSearch).not.toHaveBeenCalled();
    expect(handleFetch).not.toHaveBeenCalled();
  });

  it('rejects search calls with invalid arguments', async () => {
    const { client } = await connectPair();
    const result = await client.callTool({
      name: 'search',
      arguments: { query: '' },
    });
    expect(result.isError).toBe(true);
    const textContent = (result.content as Array<{ type: string; text: string }>)[0];
    expect(textContent?.text).toContain('invalid arguments for search');
    expect(handleSearch).not.toHaveBeenCalled();
  });

  it('rejects fetch calls with invalid arguments', async () => {
    const { client } = await connectPair();
    const result = await client.callTool({
      name: 'fetch',
      arguments: { url: 'not-a-url' },
    });
    expect(result.isError).toBe(true);
    const textContent = (result.content as Array<{ type: string; text: string }>)[0];
    expect(textContent?.text).toContain('invalid arguments for fetch');
    expect(handleFetch).not.toHaveBeenCalled();
  });
});
