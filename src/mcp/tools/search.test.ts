import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
vi.mock('axios');
import axios from 'axios';
import type { IpcClient } from '../../ipc/client.js';
import { handleSearch } from './search.js';

const mockedGet = vi.mocked(axios.get);

interface AxiosGetConfig {
  params?: Record<string, unknown>;
  headers?: Record<string, unknown>;
}

function buildCalledUrl(): string {
  const call = mockedGet.mock.calls[0];
  if (!call) {
    throw new Error('axios.get was not called');
  }
  const base = call[0] as string;
  const config = call[1] as AxiosGetConfig | undefined;
  const params = config?.params ?? {};
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    search.set(k, String(v));
  }
  return `${base}?${search.toString()}`;
}

function getCalledHeaders(): Record<string, unknown> {
  const call = mockedGet.mock.calls[0];
  if (!call) {
    throw new Error('axios.get was not called');
  }
  const config = call[1] as AxiosGetConfig | undefined;
  return config?.headers ?? {};
}

describe('handleSearch', () => {
  beforeEach(() => {
    mockedGet.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('maps Brave results to SearchResult[] and calls API with correct URL/headers', async () => {
    vi.stubEnv('BRAVE_API_KEY', 'test-key');
    mockedGet.mockResolvedValueOnce({
      data: {
        web: {
          results: [
            { title: 'T1', url: 'https://example.com/1', description: 'D1' },
            { title: 'T2', url: 'https://example.com/2', description: 'D2' },
            { title: 'T3', url: 'https://example.com/3', description: 'D3' },
          ],
        },
      },
    });

    const result = await handleSearch({ query: 'test' });

    const url = buildCalledUrl();
    expect(url).toContain('q=test');
    expect(url).toContain('count=10');
    expect(getCalledHeaders()).toMatchObject({
      'X-Subscription-Token': 'test-key',
      Accept: 'application/json',
    });

    expect(result.isError).toBeFalsy();
    const content = result.content;
    expect(Array.isArray(content)).toBe(true);
    const first = content?.[0];
    expect(first?.type).toBe('text');
    const text = first?.type === 'text' ? first.text : '';
    const parsed = JSON.parse(text) as unknown;
    expect(parsed).toEqual([
      { title: 'T1', url: 'https://example.com/1', snippet: 'D1' },
      { title: 'T2', url: 'https://example.com/2', snippet: 'D2' },
      { title: 'T3', url: 'https://example.com/3', snippet: 'D3' },
    ]);
  });

  it('clamps count above 20 down to 20', async () => {
    vi.stubEnv('BRAVE_API_KEY', 'test-key');
    mockedGet.mockResolvedValueOnce({ data: { web: { results: [] } } });

    await handleSearch({ query: 'q', count: 100 });

    const url = buildCalledUrl();
    expect(url).toContain('count=20');
  });

  it('throws when BRAVE_API_KEY is missing', async () => {
    vi.stubEnv('BRAVE_API_KEY', '');
    await expect(handleSearch({ query: 'anything' })).rejects.toThrow(
      'BRAVE_API_KEY is not set',
    );
  });

  it('returns isError result on HTTP failure', async () => {
    vi.stubEnv('BRAVE_API_KEY', 'test-key');
    mockedGet.mockRejectedValueOnce(new Error('network down'));

    const result = await handleSearch({ query: 'boom' });

    expect(result.isError).toBe(true);
    const first = result.content?.[0];
    expect(first?.type).toBe('text');
    const text = first?.type === 'text' ? first.text : '';
    expect(text).toContain('network down');
  });

  it('writes the query to stderr', async () => {
    vi.stubEnv('BRAVE_API_KEY', 'test-key');
    mockedGet.mockResolvedValueOnce({
      data: {
        web: {
          results: [{ title: 'T', url: 'https://example.com', description: 'D' }],
        },
      },
    });
    const writeSpy = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);

    await handleSearch({ query: 'visible-query' });

    const calls = writeSpy.mock.calls.map((c) => String(c[0]));
    const joined = calls.join('');
    expect(joined).toContain('visible-query');

    writeSpy.mockRestore();
  });

  it('sends a SearchEvent via IpcClient when provided', async () => {
    vi.stubEnv('BRAVE_API_KEY', 'test-key');
    mockedGet.mockResolvedValueOnce({
      data: {
        web: {
          results: [
            { title: 'R1', url: 'https://example.com/1', description: 'S1' },
          ],
        },
      },
    });

    const mockClient: IpcClient = { send: vi.fn(), close: vi.fn() };

    await handleSearch({ query: 'ipc-query' }, mockClient);

    expect(mockClient.send).toHaveBeenCalledTimes(1);
    const event = vi.mocked(mockClient.send).mock.calls[0]?.[0];
    expect(event).toMatchObject({
      type: 'search',
      query: 'ipc-query',
      count: 10,
      results: [
        { title: 'R1', url: 'https://example.com/1', snippet: 'S1' },
      ],
    });
    expect(event).toHaveProperty('timestamp');
  });
});
