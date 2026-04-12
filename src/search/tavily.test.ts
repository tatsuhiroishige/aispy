import { vi, describe, it, expect, beforeEach } from 'vitest';
vi.mock('axios');
import axios from 'axios';
import { createTavilyBackend } from './tavily.js';

const mockedPost = vi.mocked(axios.post);

describe('createTavilyBackend', () => {
  beforeEach(() => {
    mockedPost.mockReset();
  });

  it('has name "tavily"', () => {
    const backend = createTavilyBackend('key');
    expect(backend.name).toBe('tavily');
  });

  it('maps Tavily response to SearchResult[]', async () => {
    mockedPost.mockResolvedValueOnce({
      data: {
        results: [
          { title: 'T1', url: 'https://example.com/1', content: 'C1' },
          { title: 'T2', url: 'https://example.com/2', content: 'C2' },
        ],
      },
    });

    const backend = createTavilyBackend('test-api-key');
    const results = await backend.search('test query', 5);

    expect(results).toEqual([
      { title: 'T1', url: 'https://example.com/1', snippet: 'C1' },
      { title: 'T2', url: 'https://example.com/2', snippet: 'C2' },
    ]);
  });

  it('sends api_key in body', async () => {
    mockedPost.mockResolvedValueOnce({ data: { results: [] } });

    const backend = createTavilyBackend('my-key');
    await backend.search('query', 10);

    expect(mockedPost).toHaveBeenCalledWith(
      'https://api.tavily.com/search',
      {
        api_key: 'my-key',
        query: 'query',
        max_results: 10,
        search_depth: 'basic',
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );
  });

  it('returns empty array when results is missing', async () => {
    mockedPost.mockResolvedValueOnce({ data: {} });

    const backend = createTavilyBackend('key');
    const results = await backend.search('q', 1);

    expect(results).toEqual([]);
  });

  it('propagates API errors', async () => {
    mockedPost.mockRejectedValueOnce(new Error('network down'));

    const backend = createTavilyBackend('key');
    await expect(backend.search('q', 1)).rejects.toThrow('network down');
  });
});
