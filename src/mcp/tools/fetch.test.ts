import { vi, describe, it, expect, beforeEach } from 'vitest';
vi.mock('axios');
import axios from 'axios';
import { createFetchCache } from '../../core/fetchCache.js';
import type { IpcClient } from '../../ipc/client.js';
import type { FetchEvent, FetchStartEvent } from '../../types.js';
import { handleFetch } from './fetch.js';

const mockedGet = vi.mocked(axios.get);

describe('handleFetch', () => {
  beforeEach(() => {
    mockedGet.mockReset();
  });

  it('converts HTML to markdown and approximates tokens', async () => {
    mockedGet.mockResolvedValueOnce({ data: '<h1>T</h1><p>body</p>' });

    const result = await handleFetch({ url: 'https://example.com/a' });

    expect(result.isError).toBeFalsy();
    const first = result.content?.[0];
    expect(first?.type).toBe('text');
    const text = first?.type === 'text' ? first.text : '';
    expect(text).toContain('# T');
    expect(text).toContain('body');

    const expectedTokens = Math.ceil(text.length / 4);
    expect(expectedTokens).toBeGreaterThan(0);

    const call = mockedGet.mock.calls[0];
    expect(call?.[0]).toBe('https://example.com/a');
  });

  it('strips <script> content from returned text', async () => {
    mockedGet.mockResolvedValueOnce({
      data: '<script>evil()</script><p>safe</p>',
    });

    const result = await handleFetch({ url: 'https://example.com/b' });

    const first = result.content?.[0];
    const text = first?.type === 'text' ? first.text : '';
    expect(text).toContain('safe');
    expect(text).not.toContain('evil()');
  });

  it('returns isError result on HTTP failure', async () => {
    mockedGet.mockRejectedValueOnce(new Error('network down'));

    const result = await handleFetch({ url: 'https://example.com/c' });

    expect(result.isError).toBe(true);
    const first = result.content?.[0];
    expect(first?.type).toBe('text');
    const text = first?.type === 'text' ? first.text : '';
    expect(text).toContain('network down');
    expect(text).toContain('fetch failed');
  });

  it('writes the url to stderr', async () => {
    mockedGet.mockResolvedValueOnce({ data: '<p>hello</p>' });
    const writeSpy = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);

    await handleFetch({ url: 'https://example.com/visible-url' });

    const calls = writeSpy.mock.calls.map((c) => String(c[0]));
    const joined = calls.join('');
    expect(joined).toContain('https://example.com/visible-url');

    writeSpy.mockRestore();
  });

  it('accepts a prompt argument without throwing', async () => {
    mockedGet.mockResolvedValueOnce({ data: '<p>hi</p>' });

    const result = await handleFetch({
      url: 'https://example.com/d',
      prompt: 'extract titles',
    });

    expect(result.isError).toBeFalsy();
  });

  it('sends FetchStartEvent and FetchEvent via IpcClient when provided', async () => {
    mockedGet.mockResolvedValueOnce({ data: '<h1>Title</h1><p>content</p>' });

    const mockClient: IpcClient = { send: vi.fn(), close: vi.fn() };

    await handleFetch({ url: 'https://example.com/ipc' }, mockClient);

    expect(mockClient.send).toHaveBeenCalledTimes(2);

    const firstEvent = vi.mocked(mockClient.send).mock.calls[0]?.[0] as FetchStartEvent;
    expect(firstEvent).toMatchObject({
      type: 'fetch-start',
      url: 'https://example.com/ipc',
    });
    expect(firstEvent).toHaveProperty('timestamp');

    const secondEvent = vi.mocked(mockClient.send).mock.calls[1]?.[0] as FetchEvent;
    expect(secondEvent).toMatchObject({
      type: 'fetch',
      url: 'https://example.com/ipc',
    });
    expect(secondEvent).toHaveProperty('timestamp');
    expect(secondEvent.durationMs).toBeGreaterThanOrEqual(0);
    expect(secondEvent.tokens).toBeGreaterThan(0);
    expect(secondEvent.content).toBeTruthy();
  });

  it('returns cached content without making an HTTP request', async () => {
    const cache = createFetchCache();
    cache.set('https://example.com/cached', 'cached content', 42);

    const result = await handleFetch(
      { url: 'https://example.com/cached' },
      undefined,
      cache,
    );

    expect(mockedGet).not.toHaveBeenCalled();
    expect(result.isError).toBeFalsy();
    const first = result.content?.[0];
    expect(first?.type).toBe('text');
    const text = first?.type === 'text' ? first.text : '';
    expect(text).toBe('cached content');
  });

  it('fetches normally when cache is empty', async () => {
    mockedGet.mockResolvedValueOnce({ data: '<p>fresh</p>' });

    const cache = createFetchCache();
    const result = await handleFetch(
      { url: 'https://example.com/miss' },
      undefined,
      cache,
    );

    expect(mockedGet).toHaveBeenCalledTimes(1);
    expect(result.isError).toBeFalsy();
    expect(cache.has('https://example.com/miss')).toBe(true);
  });
});
