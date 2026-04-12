import { vi, describe, it, expect, beforeEach } from 'vitest';
vi.mock('axios');
import axios from 'axios';
import { createSerperBackend } from './serper.js';

const mockedPost = vi.mocked(axios.post);

describe('createSerperBackend', () => {
  beforeEach(() => {
    mockedPost.mockReset();
  });

  it('has name "serper"', () => {
    const backend = createSerperBackend('key');
    expect(backend.name).toBe('serper');
  });

  it('maps Serper response to SearchResult[]', async () => {
    mockedPost.mockResolvedValueOnce({
      data: {
        organic: [
          { title: 'T1', link: 'https://example.com/1', snippet: 'S1' },
          { title: 'T2', link: 'https://example.com/2', snippet: 'S2' },
        ],
      },
    });

    const backend = createSerperBackend('test-api-key');
    const results = await backend.search('test query', 5);

    expect(results).toEqual([
      { title: 'T1', url: 'https://example.com/1', snippet: 'S1' },
      { title: 'T2', url: 'https://example.com/2', snippet: 'S2' },
    ]);
  });

  it('sends correct headers and body', async () => {
    mockedPost.mockResolvedValueOnce({ data: { organic: [] } });

    const backend = createSerperBackend('my-key');
    await backend.search('query', 10);

    expect(mockedPost).toHaveBeenCalledWith(
      'https://google.serper.dev/search',
      { q: 'query', num: 10 },
      {
        headers: {
          'X-API-KEY': 'my-key',
          'Content-Type': 'application/json',
        },
      },
    );
  });

  it('returns empty array when organic is missing', async () => {
    mockedPost.mockResolvedValueOnce({ data: {} });

    const backend = createSerperBackend('key');
    const results = await backend.search('q', 1);

    expect(results).toEqual([]);
  });

  it('propagates API errors', async () => {
    mockedPost.mockRejectedValueOnce(new Error('network down'));

    const backend = createSerperBackend('key');
    await expect(backend.search('q', 1)).rejects.toThrow('network down');
  });
});
