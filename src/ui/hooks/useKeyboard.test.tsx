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
});
