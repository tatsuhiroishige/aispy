import { describe, it, expect } from 'vitest';
import { render } from 'ink-testing-library';
import { StatusBar } from './StatusBar.js';
import type { SessionStats } from '../../core/store.js';

function makeStats(overrides?: Partial<SessionStats>): SessionStats {
  return {
    searchCount: 0,
    fetchCount: 0,
    totalTokens: 0,
    startTime: Date.now(),
    elapsedMs: 0,
    ...overrides,
  };
}

describe('StatusBar', () => {
  it('shows correct stats formatting', () => {
    const stats = makeStats({ searchCount: 3, fetchCount: 5, totalTokens: 8241, elapsedMs: 14200 });
    const { lastFrame } = render(
      <StatusBar stats={stats} connected={true} focusPane="log" hasViewerContent={false} />,
    );
    const frame = lastFrame()!;

    expect(frame).toContain('connected');
    expect(frame).toContain('3 searches');
    expect(frame).toContain('5 pages');
    expect(frame).toContain('8,241 tokens');
    expect(frame).toContain('14.2s');
  });

  it('shows disconnected state', () => {
    const stats = makeStats();
    const { lastFrame } = render(
      <StatusBar stats={stats} connected={false} focusPane="log" hasViewerContent={false} />,
    );
    const frame = lastFrame()!;

    expect(frame).toContain('disconnected');
  });

  it('shows key hints for log pane', () => {
    const stats = makeStats();
    const { lastFrame } = render(
      <StatusBar stats={stats} connected={true} focusPane="log" hasViewerContent={false} />,
    );
    const frame = lastFrame()!;

    expect(frame).toContain('[Tab] viewer');
    expect(frame).toContain('[Enter] preview');
    expect(frame).toContain('[q]');
    expect(frame).toContain('quit');
  });

  it('shows key hints for viewer pane with content', () => {
    const stats = makeStats();
    const { lastFrame } = render(
      <StatusBar stats={stats} connected={true} focusPane="viewer" hasViewerContent={true} />,
    );
    const frame = lastFrame()!;

    expect(frame).toContain('[Tab] log');
    expect(frame).toContain('[o] browser');
    expect(frame).toContain('[q] back');
  });

  it('omits [o] browser when viewer has no content', () => {
    const stats = makeStats();
    const { lastFrame } = render(
      <StatusBar stats={stats} connected={true} focusPane="viewer" hasViewerContent={false} />,
    );
    const frame = lastFrame()!;

    expect(frame).toContain('[Tab] log');
    expect(frame).not.toContain('[o] browser');
  });
});
