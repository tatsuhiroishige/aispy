import { describe, it, expect } from 'vitest';
import { detectTermCapability } from './termCapability.js';

describe('termCapability detection', () => {
  it('detects kitty via KITTY_WINDOW_ID', () => {
    const cap = detectTermCapability({ KITTY_WINDOW_ID: '1' });
    expect(cap.imageProtocol).toBe('kitty');
  });

  it('detects kitty via TERM=xterm-kitty', () => {
    const cap = detectTermCapability({ TERM: 'xterm-kitty' });
    expect(cap.imageProtocol).toBe('kitty');
  });

  it('detects wezterm as kitty protocol', () => {
    const cap = detectTermCapability({ WEZTERM_PANE: '1' });
    expect(cap.imageProtocol).toBe('kitty');
  });

  it('detects iTerm2', () => {
    const cap = detectTermCapability({ TERM_PROGRAM: 'iTerm.app' });
    expect(cap.imageProtocol).toBe('iterm2');
  });

  it('detects foot as sixel', () => {
    const cap = detectTermCapability({ TERM: 'foot' });
    expect(cap.imageProtocol).toBe('sixel');
  });

  it('returns none for unknown terminal', () => {
    const cap = detectTermCapability({ TERM: 'xterm-256color' });
    expect(cap.imageProtocol).toBe('none');
  });

  it('respects ASPYPY_IMAGE=none override', () => {
    const cap = detectTermCapability({
      TERM: 'xterm-kitty',
      ASPYPY_IMAGE: 'none',
    });
    expect(cap.imageProtocol).toBe('none');
  });

  it('provides default cell pixel dimensions', () => {
    const cap = detectTermCapability({});
    expect(cap.cellPixelWidth).toBeGreaterThan(0);
    expect(cap.cellPixelHeight).toBeGreaterThan(0);
  });
});
