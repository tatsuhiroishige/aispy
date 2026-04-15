import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { navigate, _internal } from './navigator.js';

vi.mock('axios');
const mockedGet = vi.mocked(axios.get);

describe('navigator.normalizeUrl', () => {
  it('adds https:// to bare hostnames', () => {
    expect(_internal.normalizeUrl('example.com')).toBe('https://example.com');
    expect(_internal.normalizeUrl('example.com/path')).toBe('https://example.com/path');
  });

  it('preserves http:// and https://', () => {
    expect(_internal.normalizeUrl('http://example.com')).toBe('http://example.com');
    expect(_internal.normalizeUrl('https://example.com')).toBe('https://example.com');
  });

  it('uses http:// for localhost', () => {
    expect(_internal.normalizeUrl('localhost:3000')).toBe('http://localhost:3000');
    expect(_internal.normalizeUrl('localhost')).toBe('http://localhost');
  });

  it('trims whitespace', () => {
    expect(_internal.normalizeUrl('  example.com  ')).toBe('https://example.com');
  });
});

describe('navigator.extractTitle', () => {
  it('extracts title tag content', () => {
    expect(_internal.extractTitle('<html><title>Hello</title></html>', 'x')).toBe('Hello');
  });

  it('falls back to given url when no title', () => {
    expect(_internal.extractTitle('<html></html>', 'fallback')).toBe('fallback');
  });

  it('normalizes whitespace and truncates long titles', () => {
    const html = `<title>  Multi\n  line\n  title  </title>`;
    expect(_internal.extractTitle(html, 'x')).toBe('Multi line title');
  });
});

describe('navigate', () => {
  beforeEach(() => {
    mockedGet.mockReset();
  });

  it('returns ok result with entry on success', async () => {
    mockedGet.mockResolvedValueOnce({
      data: '<html><head><title>Demo</title></head><body><p>Hello world</p></body></html>',
    });
    const result = await navigate('example.com');
    expect(result.ok).toBe(true);
    expect(result.entry?.url).toBe('https://example.com');
    expect(result.entry?.title).toBe('Demo');
    expect(result.entry?.content).toContain('Hello world');
  });

  it('returns error on axios failure', async () => {
    mockedGet.mockRejectedValueOnce(new Error('network down'));
    const result = await navigate('example.com');
    expect(result.ok).toBe(false);
    expect(result.error).toContain('network down');
  });

  it('returns error for empty input', async () => {
    const result = await navigate('   ');
    expect(result.ok).toBe(false);
  });
});
