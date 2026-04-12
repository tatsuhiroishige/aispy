import { useInput } from 'ink';

export interface KeyHandlers {
  onTab(): void;
  onUp(): void;
  onDown(): void;
  onEnter(): void;
  onOpen(): void;
  onQuit(): void;
  onFilter(): void;
  onStats(): void;
  onEscape(): void;
  onExport(): void;
}

export interface KeyboardOptions {
  isActive?: boolean;
}

/** Wraps Ink useInput and dispatches to named key handlers. */
export function useKeyboard(handlers: KeyHandlers, options?: KeyboardOptions): void {
  useInput((input, key) => {
    if (input === 'e' && key.ctrl) {
      handlers.onExport();
      return;
    }
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
    if (input === '/') {
      handlers.onFilter();
      return;
    }
    if (input === 's') {
      handlers.onStats();
      return;
    }
    if (key.escape) {
      handlers.onEscape();
      return;
    }
  }, { isActive: options?.isActive });
}
