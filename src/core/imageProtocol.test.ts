import { describe, it, expect, beforeEach } from 'vitest';
import {
  encodeKitty,
  encodeITerm2,
  encodeImageEscape,
  encodeKittyVirtualUpload,
  encodeKittyPlaceholder,
  diacriticForIndex,
  diacriticCapacity,
  PLACEHOLDER_CODEPOINT,
  resetImageIds,
} from './imageProtocol.js';

function makeImage(width: number, height: number): { width: number; height: number; data: Buffer } {
  return {
    width,
    height,
    data: Buffer.alloc(width * height * 4, 0xff),
  };
}

describe('Kitty protocol encoder', () => {
  beforeEach(() => {
    resetImageIds();
  });

  it('emits APC G escape with control fields', () => {
    const esc = encodeKitty(makeImage(4, 2));
    expect(esc).toContain('\x1b_G');
    expect(esc).toContain('a=T');
    expect(esc).toContain('f=32');
    expect(esc).toContain('s=4');
    expect(esc).toContain('v=2');
    expect(esc).toContain('\x1b\\');
  });

  it('chunks large payloads', () => {
    const big = makeImage(100, 100);
    const esc = encodeKitty(big);
    // Expect multiple APC sequences; each starts with ESC_G
    let count = 0;
    let idx = 0;
    while ((idx = esc.indexOf('\x1b_G', idx)) !== -1) {
      count++;
      idx++;
    }
    expect(count).toBeGreaterThan(1);
  });

  it('marks last chunk with m=0 and intermediate with m=1', () => {
    const big = makeImage(100, 100);
    const esc = encodeKitty(big);
    // Find all m= values
    const matches = Array.from(esc.matchAll(/m=([01])/g));
    expect(matches.length).toBeGreaterThan(1);
    // Last chunk m=0
    expect(matches[matches.length - 1]![1]).toBe('0');
    // Intermediate chunks m=1
    for (let i = 0; i < matches.length - 1; i++) {
      expect(matches[i]![1]).toBe('1');
    }
  });

  it('increments image id for subsequent calls', () => {
    const e1 = encodeKitty(makeImage(4, 2));
    const e2 = encodeKitty(makeImage(4, 2));
    const id1 = /i=(\d+)/.exec(e1)?.[1];
    const id2 = /i=(\d+)/.exec(e2)?.[1];
    expect(id1).not.toBe(id2);
  });
});

describe('iTerm2 protocol encoder', () => {
  it('emits OSC 1337 inline File sequence', () => {
    const esc = encodeITerm2(makeImage(4, 2), Buffer.from([1, 2, 3, 4]));
    expect(esc).toContain('\x1b]1337;File=inline=1');
    expect(esc).toContain('width=4px');
    expect(esc).toContain('height=2px');
    expect(esc).toContain('\x07');
  });
});

describe('Kitty virtual upload encoder', () => {
  it('emits APC with U=1 and explicit id', () => {
    const esc = encodeKittyVirtualUpload(makeImage(4, 2), 42);
    expect(esc).toContain('\x1b_G');
    expect(esc).toContain('a=T');
    expect(esc).toContain('U=1');
    expect(esc).toContain('i=42');
    expect(esc).toContain('q=2');
    expect(esc).not.toContain('C=1');
  });

  it('chunks large payloads with m=1/m=0', () => {
    const esc = encodeKittyVirtualUpload(makeImage(100, 100), 7);
    const matches = Array.from(esc.matchAll(/m=([01])/g));
    expect(matches.length).toBeGreaterThan(1);
    expect(matches[matches.length - 1]![1]).toBe('0');
  });
});

describe('Kitty placeholder cell encoder', () => {
  it('builds placeholder codepoint + 2 diacritics', () => {
    const s = encodeKittyPlaceholder(0, 0);
    expect(s.codePointAt(0)).toBe(PLACEHOLDER_CODEPOINT);
    expect(s.codePointAt(2)).toBe(diacriticForIndex(0));
  });

  it('different row/col give different diacritics', () => {
    const a = encodeKittyPlaceholder(0, 0);
    const b = encodeKittyPlaceholder(1, 2);
    expect(a).not.toBe(b);
  });

  it('throws for out-of-range index', () => {
    expect(() => encodeKittyPlaceholder(diacriticCapacity(), 0)).toThrow();
    expect(() => encodeKittyPlaceholder(0, diacriticCapacity())).toThrow();
  });
});

describe('encodeImageEscape dispatch', () => {
  it('returns empty string for protocol=none', () => {
    expect(encodeImageEscape('none', makeImage(4, 2))).toBe('');
  });

  it('returns empty string for protocol=sixel (not yet implemented)', () => {
    expect(encodeImageEscape('sixel', makeImage(4, 2))).toBe('');
  });

  it('dispatches to kitty encoder', () => {
    const esc = encodeImageEscape('kitty', makeImage(4, 2));
    expect(esc).toContain('\x1b_G');
  });

  it('dispatches to iterm2 encoder with raw bytes', () => {
    const esc = encodeImageEscape('iterm2', makeImage(4, 2), Buffer.from([1, 2, 3]));
    expect(esc).toContain('\x1b]1337');
  });
});
