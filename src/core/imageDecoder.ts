import axios, { AxiosError } from 'axios';

export interface DecodedImage {
  width: number;
  height: number;
  data: Buffer;
}

const CACHE_MAX = 32;
const cache = new Map<string, DecodedImage>();
const inFlight = new Map<string, Promise<DecodedImage | null>>();

const MAX_FETCH_BYTES = 5 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 10_000;
const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 250;
const MAX_BACKOFF_MS = 4_000;
const USER_AGENT =
  'Mozilla/5.0 (compatible; aispy/0.1.0; +https://github.com/tatsuhiroishige/aispy)';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseRetryAfter(header: string | undefined): number | null {
  if (!header) return null;
  const secs = Number(header);
  if (Number.isFinite(secs)) return Math.max(0, secs * 1000);
  const date = Date.parse(header);
  if (!Number.isNaN(date)) return Math.max(0, date - Date.now());
  return null;
}

function backoffMs(attempt: number): number {
  const exp = Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * 2 ** attempt);
  const jitter = Math.random() * exp * 0.3;
  return Math.floor(exp + jitter);
}

function isRetryableError(err: unknown): boolean {
  if (!(err instanceof AxiosError)) return false;
  if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT') return true;
  const status = err.response?.status;
  if (status === 429) return true;
  if (status !== undefined && status >= 500 && status < 600) return true;
  return false;
}

function cacheGet(url: string): DecodedImage | undefined {
  const hit = cache.get(url);
  if (!hit) return undefined;
  cache.delete(url);
  cache.set(url, hit);
  return hit;
}

function cacheSet(url: string, img: DecodedImage): void {
  cache.set(url, img);
  if (cache.size > CACHE_MAX) {
    const firstKey = cache.keys().next().value;
    if (firstKey !== undefined) cache.delete(firstKey);
  }
}

async function fetchImageBytes(url: string): Promise<Buffer> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await axios.get<ArrayBuffer>(url, {
        responseType: 'arraybuffer',
        timeout: FETCH_TIMEOUT_MS,
        maxContentLength: MAX_FETCH_BYTES,
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'image/*',
        },
      });
      return Buffer.from(response.data);
    } catch (err) {
      lastErr = err;
      if (attempt === MAX_RETRIES || !isRetryableError(err)) break;
      const retryAfter =
        err instanceof AxiosError
          ? parseRetryAfter(err.response?.headers?.['retry-after'] as string | undefined)
          : null;
      const delay = retryAfter ?? backoffMs(attempt);
      await sleep(Math.min(delay, MAX_BACKOFF_MS));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

export async function decodeImage(
  url: string,
  targetPixelWidth: number,
  targetPixelHeight: number,
): Promise<DecodedImage | null> {
  const cacheKey = `${url}|${targetPixelWidth}x${targetPixelHeight}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  const existing = inFlight.get(cacheKey);
  if (existing) return existing;

  const promise = (async (): Promise<DecodedImage | null> => {
    try {
      const bytes = await fetchImageBytes(url);
      const { default: sharp } = await import('sharp');
      const { data, info } = await sharp(bytes)
        .resize(targetPixelWidth, targetPixelHeight, {
          fit: 'inside',
          withoutEnlargement: true,
        })
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

      const result: DecodedImage = {
        width: info.width,
        height: info.height,
        data,
      };
      cacheSet(cacheKey, result);
      return result;
    } catch {
      return null;
    }
  })();

  inFlight.set(cacheKey, promise);
  try {
    return await promise;
  } finally {
    inFlight.delete(cacheKey);
  }
}

export function clearImageCache(): void {
  cache.clear();
  inFlight.clear();
}
