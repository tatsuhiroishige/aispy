import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createBookmarkStore } from './bookmarks.js';

describe('createBookmarkStore', () => {
  let dir: string;
  let file: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'aispy-bm-'));
    file = join(dir, 'bookmarks.json');
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('starts empty when file does not exist', () => {
    const store = createBookmarkStore(file);
    expect(store.list()).toEqual([]);
    expect(existsSync(file)).toBe(false);
  });

  it('add persists to disk', () => {
    const store = createBookmarkStore(file);
    store.add('https://a.com', 'Alpha');
    expect(store.has('https://a.com')).toBe(true);
    expect(existsSync(file)).toBe(true);
    const raw = JSON.parse(readFileSync(file, 'utf-8'));
    expect(raw).toHaveLength(1);
    expect(raw[0].url).toBe('https://a.com');
  });

  it('toggle adds then removes', () => {
    const store = createBookmarkStore(file);
    expect(store.toggle('https://a.com', 'A')).toBe(true);
    expect(store.has('https://a.com')).toBe(true);
    expect(store.toggle('https://a.com', 'A')).toBe(false);
    expect(store.has('https://a.com')).toBe(false);
  });

  it('add is idempotent', () => {
    const store = createBookmarkStore(file);
    store.add('https://a.com', 'A');
    store.add('https://a.com', 'A2');
    expect(store.list()).toHaveLength(1);
  });

  it('remove removes', () => {
    const store = createBookmarkStore(file);
    store.add('https://a.com', 'A');
    store.add('https://b.com', 'B');
    store.remove('https://a.com');
    expect(store.list().map((b) => b.url)).toEqual(['https://b.com']);
  });

  it('loads existing bookmarks on construction', () => {
    const s1 = createBookmarkStore(file);
    s1.add('https://keep.com', 'Keep');
    const s2 = createBookmarkStore(file);
    expect(s2.has('https://keep.com')).toBe(true);
  });

  it('tolerates malformed JSON by starting empty', () => {
    writeFileSync(file, 'not json', 'utf-8');
    const store = createBookmarkStore(file);
    expect(store.list()).toEqual([]);
  });
});
