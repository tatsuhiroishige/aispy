import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';

export interface Bookmark {
  url: string;
  title: string;
  addedAt: number;
}

const DEFAULT_PATH = join(homedir(), '.aispy', 'bookmarks.json');

function load(path: string): Bookmark[] {
  if (!existsSync(path)) return [];
  try {
    const raw = readFileSync(path, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (x): x is Bookmark =>
        typeof x?.url === 'string' &&
        typeof x?.title === 'string' &&
        typeof x?.addedAt === 'number',
    );
  } catch {
    return [];
  }
}

function save(path: string, bookmarks: Bookmark[]): void {
  try {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify(bookmarks, null, 2), 'utf-8');
  } catch {
    // ignore persistence errors
  }
}

export interface BookmarkStore {
  list(): readonly Bookmark[];
  has(url: string): boolean;
  toggle(url: string, title: string): boolean;
  add(url: string, title: string): void;
  remove(url: string): void;
}

export function createBookmarkStore(path: string = DEFAULT_PATH): BookmarkStore {
  let bookmarks: Bookmark[] = load(path);

  return {
    list(): readonly Bookmark[] {
      return bookmarks;
    },
    has(url: string): boolean {
      return bookmarks.some((b) => b.url === url);
    },
    toggle(url: string, title: string): boolean {
      const idx = bookmarks.findIndex((b) => b.url === url);
      if (idx >= 0) {
        bookmarks = [...bookmarks.slice(0, idx), ...bookmarks.slice(idx + 1)];
        save(path, bookmarks);
        return false;
      }
      bookmarks = [...bookmarks, { url, title, addedAt: Date.now() }];
      save(path, bookmarks);
      return true;
    },
    add(url: string, title: string): void {
      if (bookmarks.some((b) => b.url === url)) return;
      bookmarks = [...bookmarks, { url, title, addedAt: Date.now() }];
      save(path, bookmarks);
    },
    remove(url: string): void {
      bookmarks = bookmarks.filter((b) => b.url !== url);
      save(path, bookmarks);
    },
  };
}
