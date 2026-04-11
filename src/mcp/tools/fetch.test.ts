import { vi, describe, it, expect, beforeEach } from 'vitest';
vi.mock('axios');
import axios from 'axios';
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
});
