import { useInput } from 'ink';

export interface KeyHandlers {
  onTab(): void;
  onUp(): void;
  onDown(): void;
  onEnter(): void;
  onOpen(): void;
  onQuit(): void;
}

/** Wraps Ink useInput and dispatches to named key handlers. */
export function useKeyboard(handlers: KeyHandlers): void {
  useInput((input, key) => {
    if (key.tab) {
      handlers.onTab();
      return;
    }
    if (key.return) {
      handlers.onEnter();
      return;
    }
    if (input === 'k') {
      handlers.onUp();
      return;
    }
    if (input === 'j') {
      handlers.onDown();
      return;
    }
    if (input === 'o') {
      handlers.onOpen();
      return;
    }
    if (input === 'q') {
      handlers.onQuit();
      return;
    }
  });
}
