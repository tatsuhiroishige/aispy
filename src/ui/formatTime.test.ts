import { describe, it, expect } from 'vitest';
import { formatTime } from './formatTime.js';

describe('formatTime', () => {
  it('formats a morning timestamp as HH:MM:SS', () => {
    const d = new Date(2026, 0, 1, 9, 5, 3);
    expect(formatTime(d.getTime())).toBe('09:05:03');
  });

  it('formats an afternoon timestamp with 24-hour hours', () => {
    const d = new Date(2026, 0, 1, 14, 30, 59);
    expect(formatTime(d.getTime())).toBe('14:30:59');
  });

  it('formats midnight correctly', () => {
    const d = new Date(2026, 0, 1, 0, 0, 0);
    expect(formatTime(d.getTime())).toBe('00:00:00');
  });
});
