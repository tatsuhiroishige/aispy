import { describe, it, expect } from 'vitest';
import {
  createHistory,
  pushEntry,
  back,
  forward,
  canBack,
  canForward,
  current,
} from './history.js';

function entry(url: string): { url: string; title: string; content: string } {
  return { url, title: url, content: `content-${url}` };
}

describe('History', () => {
  it('starts empty with index -1', () => {
    const h = createHistory();
    expect(h.entries).toEqual([]);
    expect(h.index).toBe(-1);
    expect(current(h)).toBeNull();
  });

  it('push sets index to last entry', () => {
    const h = pushEntry(pushEntry(createHistory(), entry('a')), entry('b'));
    expect(h.index).toBe(1);
    expect(current(h)?.url).toBe('b');
  });

  it('canBack/canForward reflect position', () => {
    let h = createHistory();
    expect(canBack(h)).toBe(false);
    expect(canForward(h)).toBe(false);
    h = pushEntry(h, entry('a'));
    expect(canBack(h)).toBe(false);
    h = pushEntry(h, entry('b'));
    expect(canBack(h)).toBe(true);
    expect(canForward(h)).toBe(false);
  });

  it('back/forward move the pointer', () => {
    let h = pushEntry(pushEntry(pushEntry(createHistory(), entry('a')), entry('b')), entry('c'));
    expect(current(h)?.url).toBe('c');
    h = back(h);
    expect(current(h)?.url).toBe('b');
    h = back(h);
    expect(current(h)?.url).toBe('a');
    h = back(h);
    expect(current(h)?.url).toBe('a'); // clamped
    h = forward(h);
    expect(current(h)?.url).toBe('b');
  });

  it('push after back truncates forward history', () => {
    let h = pushEntry(pushEntry(pushEntry(createHistory(), entry('a')), entry('b')), entry('c'));
    h = back(h); // at b
    h = pushEntry(h, entry('d'));
    expect(h.entries.map((e) => e.url)).toEqual(['a', 'b', 'd']);
    expect(canForward(h)).toBe(false);
  });

  it('is immutable (returns new objects)', () => {
    const h1 = createHistory();
    const h2 = pushEntry(h1, entry('a'));
    expect(h1).not.toBe(h2);
    expect(h1.entries).toEqual([]);
  });
});
