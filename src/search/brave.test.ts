import { vi, describe, it, expect, beforeEach } from 'vitest';
vi.mock('axios');
import axios from 'axios';
import { createBraveBackend } from './brave.js';

const mockedGet = vi.mocked(axios.get);

describe('createBraveBackend', () => {
  beforeEach(() => {
    mockedGet.mockReset();
  });

  it('has name "brave"', () => {
    const backend = createBraveBackend('key');
    expect(backend.name).toBe('brave');
  });

  it('returns SearchResult[] from Brave API response', async () => {
    mockedGet.mockResolvedValueOnce({
      data: {
        web: {
          results: [
            { title: 'T1', url: 'https://example.com/1', description: 'D1' },
            { title: 'T2', url: 'https://example.com/2', description: 'D2' },
          ],
        },
      },
    });

    const backend = createBraveBackend('test-api-key');
    const results = await backend.search('test query', 5);

    expect(results).toEqual([
      { title: 'T1', url: 'https://example.com/1', snippet: 'D1' },
      { title: 'T2', url: 'https://example.com/2', snippet: 'D2' },
    ]);

    expect(mockedGet).toHaveBeenCalledWith(
      'https://api.search.brave.com/res/v1/web/search',
      {
        params: { q: 'test query', count: 5 },
        headers: {
          'X-Subscription-Token': 'test-api-key',
          Accept: 'application/json',
        },
      },
    );
  });

  it('defaults missing fields to empty strings', async () => {
    mockedGet.mockResolvedValueOnce({
      data: {
        web: {
          results: [{}],
        },
      },
    });

    const backend = createBraveBackend('key');
    const results = await backend.search('q', 1);

    expect(results).toEqual([{ title: '', url: '', snippet: '' }]);
  });

  it('returns empty array when web.results is missing', async () => {
    mockedGet.mockResolvedValueOnce({ data: {} });

    const backend = createBraveBackend('key');
    const results = await backend.search('q', 1);

    expect(results).toEqual([]);
  });

  it('propagates API errors', async () => {
    mockedGet.mockRejectedValueOnce(new Error('network down'));

    const backend = createBraveBackend('key');
    await expect(backend.search('q', 1)).rejects.toThrow('network down');
  });
});
