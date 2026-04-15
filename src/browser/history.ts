import type { LinkHint } from './linkHints.js';

export interface HistoryEntry {
  url: string;
  title: string;
  content: string;
  imagePrologue?: string;
  links?: LinkHint[];
}

export interface History {
  entries: HistoryEntry[];
  index: number;
}

export function createHistory(): History {
  return { entries: [], index: -1 };
}

export function pushEntry(h: History, entry: HistoryEntry): History {
  const kept = h.entries.slice(0, h.index + 1);
  const entries = [...kept, entry];
  return { entries, index: entries.length - 1 };
}

export function canBack(h: History): boolean {
  return h.index > 0;
}

export function canForward(h: History): boolean {
  return h.index >= 0 && h.index < h.entries.length - 1;
}

export function back(h: History): History {
  if (!canBack(h)) return h;
  return { entries: h.entries, index: h.index - 1 };
}

export function forward(h: History): History {
  if (!canForward(h)) return h;
  return { entries: h.entries, index: h.index + 1 };
}

export function current(h: History): HistoryEntry | null {
  if (h.index < 0 || h.index >= h.entries.length) return null;
  return h.entries[h.index]!;
}
