import { describe, it, expect, vi } from 'vitest';
import { render } from 'ink-testing-library';
import { Text } from 'ink';
import { useKeyboard } from './useKeyboard.js';
import type { KeyHandlers } from './useKeyboard.js';

function TestKeyComponent({ handlers }: { handlers: KeyHandlers }) {
  useKeyboard(handlers);
  return <Text>ready</Text>;
}

function makeHandlers(): KeyHandlers {
  return {
    onTab: vi.fn(),
    onUp: vi.fn(),
    onDown: vi.fn(),
    onEnter: vi.fn(),
    onOpen: vi.fn(),
    onQuit: vi.fn(),
    onFilter: vi.fn(),
    onStats: vi.fn(),
    onEscape: vi.fn(),
    onExport: vi.fn(),
  };
}

describe('useKeyboard', () => {
  it('dispatches j to onDown', () => {
    const handlers = makeHandlers();
    const { stdin } = render(<TestKeyComponent handlers={handlers} />);
    stdin.write('j');
    expect(handlers.onDown).toHaveBeenCalledTimes(1);
  });

  it('dispatches k to onUp', () => {
    const handlers = makeHandlers();
    const { stdin } = render(<TestKeyComponent handlers={handlers} />);
    stdin.write('k');
    expect(handlers.onUp).toHaveBeenCalledTimes(1);
  });

  it('dispatches o to onOpen', () => {
    const handlers = makeHandlers();
    const { stdin } = render(<TestKeyComponent handlers={handlers} />);
    stdin.write('o');
    expect(handlers.onOpen).toHaveBeenCalledTimes(1);
  });

  it('dispatches q to onQuit', () => {
    const handlers = makeHandlers();
    const { stdin } = render(<TestKeyComponent handlers={handlers} />);
    stdin.write('q');
    expect(handlers.onQuit).toHaveBeenCalledTimes(1);
  });

  it('dispatches Enter to onEnter', () => {
    const handlers = makeHandlers();
    const { stdin } = render(<TestKeyComponent handlers={handlers} />);
    stdin.write('\r');
    expect(handlers.onEnter).toHaveBeenCalledTimes(1);
  });

  it('dispatches Tab to onTab', () => {
    const handlers = makeHandlers();
    const { stdin } = render(<TestKeyComponent handlers={handlers} />);
    stdin.write('\t');
    expect(handlers.onTab).toHaveBeenCalledTimes(1);
  });

  it('dispatches / to onFilter', () => {
    const handlers = makeHandlers();
    const { stdin } = render(<TestKeyComponent handlers={handlers} />);
    stdin.write('/');
    expect(handlers.onFilter).toHaveBeenCalledTimes(1);
  });

  it('dispatches s to onStats', () => {
    const handlers = makeHandlers();
    const { stdin } = render(<TestKeyComponent handlers={handlers} />);
    stdin.write('s');
    expect(handlers.onStats).toHaveBeenCalledTimes(1);
  });

  it('dispatches Escape to onEscape', async () => {
    const handlers = makeHandlers();
    const { stdin } = render(<TestKeyComponent handlers={handlers} />);
    stdin.write('\u001B');
    // Ink buffers standalone escape and flushes via setImmediate
    await new Promise((resolve) => { setImmediate(resolve); });
    expect(handlers.onEscape).toHaveBeenCalledTimes(1);
  });

  it('dispatches Ctrl+E to onExport', () => {
    const handlers = makeHandlers();
    const { stdin } = render(<TestKeyComponent handlers={handlers} />);
    stdin.write('\x05');
    expect(handlers.onExport).toHaveBeenCalledTimes(1);
  });

  it('dispatches g to onGoUrl', () => {
    const handlers: KeyHandlers = { onGoUrl: vi.fn() };
    const { stdin } = render(<TestKeyComponent handlers={handlers} />);
    stdin.write('g');
    expect(handlers.onGoUrl).toHaveBeenCalledTimes(1);
  });

  it('dispatches h to onBack and l to onForward', () => {
    const handlers: KeyHandlers = { onBack: vi.fn(), onForward: vi.fn() };
    const { stdin } = render(<TestKeyComponent handlers={handlers} />);
    stdin.write('h');
    stdin.write('l');
    expect(handlers.onBack).toHaveBeenCalledTimes(1);
    expect(handlers.onForward).toHaveBeenCalledTimes(1);
  });

  it('dispatches r to onReload', () => {
    const handlers: KeyHandlers = { onReload: vi.fn() };
    const { stdin } = render(<TestKeyComponent handlers={handlers} />);
    stdin.write('r');
    expect(handlers.onReload).toHaveBeenCalledTimes(1);
  });

  it('dispatches t to onNewTab and w to onCloseTab', () => {
    const handlers: KeyHandlers = { onNewTab: vi.fn(), onCloseTab: vi.fn() };
    const { stdin } = render(<TestKeyComponent handlers={handlers} />);
    stdin.write('t');
    stdin.write('w');
    expect(handlers.onNewTab).toHaveBeenCalledTimes(1);
    expect(handlers.onCloseTab).toHaveBeenCalledTimes(1);
  });

  it('dispatches digits 1-9 to onSwitchTab (zero-indexed)', () => {
    const handlers: KeyHandlers = { onSwitchTab: vi.fn() };
    const { stdin } = render(<TestKeyComponent handlers={handlers} />);
    stdin.write('1');
    stdin.write('5');
    stdin.write('9');
    expect(handlers.onSwitchTab).toHaveBeenNthCalledWith(1, 0);
    expect(handlers.onSwitchTab).toHaveBeenNthCalledWith(2, 4);
    expect(handlers.onSwitchTab).toHaveBeenNthCalledWith(3, 8);
  });

  it('dispatches f to onLinkHints', () => {
    const handlers: KeyHandlers = { onLinkHints: vi.fn() };
    const { stdin } = render(<TestKeyComponent handlers={handlers} />);
    stdin.write('f');
    expect(handlers.onLinkHints).toHaveBeenCalledTimes(1);
  });
});
