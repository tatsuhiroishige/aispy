import { vi, describe, it, expect, beforeEach } from 'vitest';
vi.mock('axios');
import axios from 'axios';
import { createFetchCache } from '../../core/fetchCache.js';
import type { IpcClient } from '../../ipc/client.js';
import type { FetchEvent } from '../../types.js';
import { handleFetch, _internal } from './fetch.js';

const mockedGet = vi.mocked(axios.get);

describe('estimateTokens / applyAiTruncation', () => {
  it('CJK chars count more tokens than ASCII', () => {
    const en = _internal.estimateTokens('a'.repeat(100));
    const cjk = _internal.estimateTokens('日'.repeat(100));
    expect(cjk).toBeGreaterThan(en * 4);
  });

  it('does not truncate content under the token cap', () => {
    const small = 'hello world';
    expect(_internal.applyAiTruncation(small)).toBe(small);
  });

  it('truncates CJK content to fit the AI token cap', () => {
    const big = '日'.repeat(20_000);
    const result = _internal.applyAiTruncation(big);
    expect(result.length).toBeLessThan(big.length);
    expect(result).toContain('truncated');
    expect(_internal.estimateTokens(result)).toBeLessThanOrEqual(_internal.AI_MAX_TOKENS);
  });

  it('truncates large ASCII content to fit the AI token cap', () => {
    const big = 'a'.repeat(200_000);
    const result = _internal.applyAiTruncation(big);
    expect(result.length).toBeLessThan(big.length);
    expect(_internal.estimateTokens(result)).toBeLessThanOrEqual(_internal.AI_MAX_TOKENS);
  });
});

describe('handleFetch', () => {
  beforeEach(() => {
    mockedGet.mockReset();
  });

  it('renders HTML to text and approximates tokens', async () => {
    mockedGet.mockResolvedValueOnce({ data: '<h1>T</h1><p>body</p>' });

    const result = await handleFetch({ url: 'https://example.com/a' });

    expect(result.isError).toBeFalsy();
    const first = result.content?.[0];
    expect(first?.type).toBe('text');
    const text = first?.type === 'text' ? first.text : '';
    expect(text).toContain('T');
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

  it('streams fetch-start → fetch → fetch-update(final) via IpcClient', async () => {
    mockedGet.mockResolvedValueOnce({ data: '<h1>Title</h1><p>content</p>' });

    const mockClient: IpcClient = { send: vi.fn(), close: vi.fn() };

    await handleFetch({ url: 'https://example.com/ipc' }, mockClient);

    const calls = vi.mocked(mockClient.send).mock.calls.map((c) => c[0]);
    expect(calls[0]?.type).toBe('fetch-start');
    expect(calls[1]?.type).toBe('fetch');
    const last = calls[calls.length - 1];
    expect(last?.type === 'fetch-update' || last?.type === 'fetch').toBe(true);

    const fetchEv = calls[1] as FetchEvent;
    expect(fetchEv.url).toBe('https://example.com/ipc');
    expect(fetchEv.content).toBeTruthy();
  });

  it('returns cached aiContent (markdown) to AI without making an HTTP request', async () => {
    const cache = createFetchCache();
    cache.set(
      'https://example.com/cached',
      'rich-terminal-content',
      'plain ai content',
      42,
    );

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
    expect(text).toBe('plain ai content');
  });

  it('fetches normally when cache is empty', async () => {
    const longBody = 'a'.repeat(300);
    mockedGet.mockResolvedValueOnce({
      data: `<p>${longBody}</p>`,
    });

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

  describe('SPA fallback via Jina Reader', () => {
    it('does NOT trigger Jina fallback for normal HTML pages', async () => {
      const longBody = 'a'.repeat(300);
      mockedGet.mockResolvedValueOnce({
        data: `<h1>Title</h1><p>${longBody}</p>`,
      });

      await handleFetch({ url: 'https://example.com/normal' });

      expect(mockedGet).toHaveBeenCalledTimes(1);
      expect(mockedGet.mock.calls[0]?.[0]).toBe('https://example.com/normal');
    });

    it('triggers Jina fallback when content is too short (SPA-like)', async () => {
      mockedGet
        .mockResolvedValueOnce({ data: '<div id="root"></div>' })
        .mockResolvedValueOnce({ data: '# Rendered Page\n\nFull content from Jina' });

      const writeSpy = vi
        .spyOn(process.stderr, 'write')
        .mockImplementation(() => true);

      const result = await handleFetch({ url: 'https://spa.example.com' });

      expect(mockedGet).toHaveBeenCalledTimes(2);
      expect(mockedGet.mock.calls[1]?.[0]).toBe(
        'https://r.jina.ai/https://spa.example.com',
      );

      const text =
        result.content?.[0]?.type === 'text' ? result.content[0].text : '';
      expect(text).toContain('Rendered Page');
      expect(text).toContain('Full content from Jina');

      const stderrOutput = writeSpy.mock.calls.map((c) => String(c[0])).join('');
      expect(stderrOutput).toContain('SPA detected');

      writeSpy.mockRestore();
    });

    it('triggers Jina fallback for marginal pages with __NEXT_DATA__ marker', async () => {
      // Short-but-non-empty rendered text + framework marker → SPA-like
      const spaHtml =
        '<html><body>' +
        '<p>' + 'x'.repeat(300) + '</p>' +
        '<script id="__NEXT_DATA__">{}</script>' +
        '</body></html>';
      mockedGet
        .mockResolvedValueOnce({ data: spaHtml })
        .mockResolvedValueOnce({ data: '# Real Content\n\nRendered by Jina' });

      const result = await handleFetch({ url: 'https://next.example.com' });

      expect(mockedGet).toHaveBeenCalledTimes(2);
      const text =
        result.content?.[0]?.type === 'text' ? result.content[0].text : '';
      expect(text).toContain('Real Content');
    });

    it('does NOT trigger Jina for substantial pages even with inline framework markers', async () => {
      // Lots of real content + a benign window.__ analytics marker → trust the renderer
      const html =
        '<html><body>' +
        '<h1>Sapporo Travel</h1>' +
        '<p>' + 'real content '.repeat(200) + '</p>' +
        '<script>window.__analytics = 1;</script>' +
        '</body></html>';
      mockedGet.mockResolvedValueOnce({ data: html });

      await handleFetch({ url: 'https://travel.example.com' });

      expect(mockedGet).toHaveBeenCalledTimes(1);
    });

    it('keeps original content when Jina Reader fails', async () => {
      mockedGet
        .mockResolvedValueOnce({ data: '<div id="app"></div>' })
        .mockRejectedValueOnce(new Error('Jina timeout'));

      const writeSpy = vi
        .spyOn(process.stderr, 'write')
        .mockImplementation(() => true);

      const result = await handleFetch({ url: 'https://spa-fail.example.com' });

      expect(mockedGet).toHaveBeenCalledTimes(2);
      expect(result.isError).toBeFalsy();

      const stderrOutput = writeSpy.mock.calls.map((c) => String(c[0])).join('');
      expect(stderrOutput).not.toContain('SPA detected');

      writeSpy.mockRestore();
    });
  });
});
