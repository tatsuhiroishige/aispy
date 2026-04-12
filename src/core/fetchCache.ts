export interface CachedPage {
  content: string;
  tokens: number;
  cachedAt: number;
}

export interface FetchCache {
  get(url: string): CachedPage | undefined;
  set(url: string, content: string, tokens: number): void;
  has(url: string): boolean;
  size(): number;
  clear(): void;
}

export function createFetchCache(
  maxEntries = 200,
  ttlMs = 15 * 60 * 1000,
): FetchCache {
  const entries = new Map<string, CachedPage>();

  return {
    get(url: string): CachedPage | undefined {
      const entry = entries.get(url);
      if (!entry) return undefined;
      if (Date.now() - entry.cachedAt >= ttlMs) {
        entries.delete(url);
        return undefined;
      }
      return entry;
    },

    set(url: string, content: string, tokens: number): void {
      if (entries.size >= maxEntries && !entries.has(url)) {
        const oldest = entries.keys().next().value as string;
        entries.delete(oldest);
      }
      entries.set(url, { content, tokens, cachedAt: Date.now() });
    },

    has(url: string): boolean {
      const entry = entries.get(url);
      if (!entry) return false;
      if (Date.now() - entry.cachedAt >= ttlMs) {
        entries.delete(url);
        return false;
      }
      return true;
    },

    size(): number {
      return entries.size;
    },

    clear(): void {
      entries.clear();
    },
  };
}
