import { describe, it, expect, beforeEach, vi } from 'vitest';
import axios, { AxiosError } from 'axios';
import sharp from 'sharp';
import { decodeImage, clearImageCache } from './imageDecoder.js';

vi.mock('axios');
const mockedGet = vi.mocked(axios.get);

async function makeTinyPng(): Promise<Buffer> {
  return sharp({
    create: { width: 8, height: 4, channels: 4, background: { r: 255, g: 0, b: 0, alpha: 1 } },
  })
    .png()
    .toBuffer();
}

describe('imageDecoder', () => {
  beforeEach(() => {
    mockedGet.mockReset();
    clearImageCache();
  });

  it('decodes a PNG into raw RGBA', async () => {
    const png = await makeTinyPng();
    mockedGet.mockResolvedValueOnce({ data: png });

    const decoded = await decodeImage('https://example.com/x.png', 8, 4);
    expect(decoded).not.toBeNull();
    expect(decoded!.width).toBe(8);
    expect(decoded!.height).toBe(4);
    expect(decoded!.data.length).toBe(8 * 4 * 4);
    // First pixel should be red
    expect(decoded!.data[0]).toBe(255);
    expect(decoded!.data[1]).toBe(0);
    expect(decoded!.data[2]).toBe(0);
  });

  it('resizes to fit target dimensions', async () => {
    const png = await sharp({
      create: { width: 100, height: 50, channels: 4, background: '#00ff00' },
    })
      .png()
      .toBuffer();
    mockedGet.mockResolvedValueOnce({ data: png });

    const decoded = await decodeImage('https://example.com/big.png', 20, 20);
    expect(decoded).not.toBeNull();
    expect(decoded!.width).toBeLessThanOrEqual(20);
    expect(decoded!.height).toBeLessThanOrEqual(20);
  });

  it('returns null on fetch error', async () => {
    mockedGet.mockRejectedValueOnce(new Error('network'));
    const decoded = await decodeImage('https://example.com/fail.png', 8, 4);
    expect(decoded).toBeNull();
  });

  it('returns null on decode error', async () => {
    mockedGet.mockResolvedValueOnce({ data: Buffer.from('not an image') });
    const decoded = await decodeImage('https://example.com/bad.png', 8, 4);
    expect(decoded).toBeNull();
  });

  it('caches decoded results', async () => {
    const png = await makeTinyPng();
    mockedGet.mockResolvedValueOnce({ data: png });

    const a = await decodeImage('https://example.com/c.png', 8, 4);
    const b = await decodeImage('https://example.com/c.png', 8, 4);
    expect(a).not.toBeNull();
    expect(b).toBe(a);
    expect(mockedGet).toHaveBeenCalledTimes(1);
  });

  it('retries on 429 with backoff and eventually succeeds', async () => {
    const png = await makeTinyPng();
    const err429 = new AxiosError('rate limit');
    err429.response = {
      status: 429,
      data: null,
      statusText: 'Too Many Requests',
      headers: {},
      config: { headers: {} as never },
    } as never;
    mockedGet
      .mockRejectedValueOnce(err429)
      .mockRejectedValueOnce(err429)
      .mockResolvedValueOnce({ data: png });

    const decoded = await decodeImage('https://example.com/retry.png', 8, 4);
    expect(decoded).not.toBeNull();
    expect(mockedGet).toHaveBeenCalledTimes(3);
  }, 10_000);

  it('gives up after MAX_RETRIES and returns null', async () => {
    const err500 = new AxiosError('server');
    err500.response = {
      status: 503,
      data: null,
      statusText: 'Service Unavailable',
      headers: {},
      config: { headers: {} as never },
    } as never;
    mockedGet.mockRejectedValue(err500);

    const decoded = await decodeImage('https://example.com/down.png', 8, 4);
    expect(decoded).toBeNull();
    expect(mockedGet).toHaveBeenCalledTimes(4); // 1 initial + 3 retries
  }, 15_000);

  it('does not retry on non-retryable errors', async () => {
    const err404 = new AxiosError('not found');
    err404.response = {
      status: 404,
      data: null,
      statusText: 'Not Found',
      headers: {},
      config: { headers: {} as never },
    } as never;
    mockedGet.mockRejectedValueOnce(err404);

    const decoded = await decodeImage('https://example.com/missing.png', 8, 4);
    expect(decoded).toBeNull();
    expect(mockedGet).toHaveBeenCalledTimes(1);
  });
});
