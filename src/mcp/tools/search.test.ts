import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

const { mockSearch } = vi.hoisted(() => ({
  mockSearch: vi.fn(),
}));

vi.mock('../../search/index.js', () => ({
  createSearchBackend: vi.fn().mockReturnValue({
    name: 'mock',
    search: mockSearch,
  }),
}));

import { createSearchBackend } from '../../search/index.js';
import type { IpcClient } from '../../ipc/client.js';
import { handleSearch } from './search.js';

describe('handleSearch', () => {
  beforeEach(() => {
    mockSearch.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns results from the search backend', async () => {
    vi.stubEnv('BRAVE_API_KEY', 'test-key');
    mockSearch.mockResolvedValueOnce([
      { title: 'T1', url: 'https://example.com/1', snippet: 'D1' },
      { title: 'T2', url: 'https://example.com/2', snippet: 'D2' },
      { title: 'T3', url: 'https://example.com/3', snippet: 'D3' },
    ]);

    const result = await handleSearch({ query: 'test' });

    expect(createSearchBackend).toHaveBeenCalled();
    expect(mockSearch).toHaveBeenCalledWith('test', 10);

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
    mockSearch.mockResolvedValueOnce([]);

    await handleSearch({ query: 'q', count: 100 });

    expect(mockSearch).toHaveBeenCalledWith('q', 20);
  });

  it('throws when BRAVE_API_KEY is missing', async () => {
    vi.stubEnv('BRAVE_API_KEY', '');
    await expect(handleSearch({ query: 'anything' })).rejects.toThrow(
      'BRAVE_API_KEY is not set',
    );
  });

  it('returns isError result on backend failure', async () => {
    vi.stubEnv('BRAVE_API_KEY', 'test-key');
    mockSearch.mockRejectedValueOnce(new Error('network down'));

    const result = await handleSearch({ query: 'boom' });

    expect(result.isError).toBe(true);
    const first = result.content?.[0];
    expect(first?.type).toBe('text');
    const text = first?.type === 'text' ? first.text : '';
    expect(text).toContain('network down');
  });

  it('writes the query to stderr', async () => {
    vi.stubEnv('BRAVE_API_KEY', 'test-key');
    mockSearch.mockResolvedValueOnce([
      { title: 'T', url: 'https://example.com', snippet: 'D' },
    ]);
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
    mockSearch.mockResolvedValueOnce([
      { title: 'R1', url: 'https://example.com/1', snippet: 'S1' },
    ]);

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
