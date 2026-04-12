import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ChildProcess } from 'node:child_process';

vi.mock('node:child_process');

describe('openInBrowser', () => {
  const unrefMock = vi.fn();
  const spawnMock = vi.fn(() => ({ unref: unrefMock }) as unknown as ChildProcess);

  beforeEach(async () => {
    vi.resetAllMocks();
    const cp = await import('node:child_process');
    vi.mocked(cp.spawn).mockImplementation(spawnMock as unknown as typeof cp.spawn);
  });

  it('calls spawn("open", [url]) on darwin', async () => {
    Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true });
    const { openInBrowser } = await import('./browserOpen.js');
    openInBrowser('https://example.com');

    expect(spawnMock).toHaveBeenCalledWith('open', ['https://example.com'], {
      detached: true,
      stdio: 'ignore',
    });
  });

  it('calls spawn("xdg-open", [url]) on linux', async () => {
    Object.defineProperty(process, 'platform', { value: 'linux', configurable: true });
    const { openInBrowser } = await import('./browserOpen.js');
    openInBrowser('https://example.com');

    expect(spawnMock).toHaveBeenCalledWith('xdg-open', ['https://example.com'], {
      detached: true,
      stdio: 'ignore',
    });
  });

  it('calls spawn("cmd", ["/c", "start", url]) on win32', async () => {
    Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
    const { openInBrowser } = await import('./browserOpen.js');
    openInBrowser('https://example.com');

    expect(spawnMock).toHaveBeenCalledWith('cmd', ['/c', 'start', 'https://example.com'], {
      detached: true,
      stdio: 'ignore',
    });
  });

  it('calls unref() on the spawned child process', async () => {
    Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true });
    const { openInBrowser } = await import('./browserOpen.js');
    openInBrowser('https://example.com');

    expect(unrefMock).toHaveBeenCalled();
  });
});
