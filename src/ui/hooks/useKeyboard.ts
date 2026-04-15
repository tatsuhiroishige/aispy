import { useInput } from 'ink';

export interface KeyHandlers {
  onTab?(): void;
  onUp?(): void;
  onDown?(): void;
  onEnter?(): void;
  onOpen?(): void;
  onQuit?(): void;
  onFilter?(): void;
  onStats?(): void;
  onEscape?(): void;
  onExport?(): void;
  onGoUrl?(): void;
  onBack?(): void;
  onForward?(): void;
  onReload?(): void;
  onNewTab?(): void;
  onCloseTab?(): void;
  onSwitchTab?(index: number): void;
  onLinkHints?(): void;
  onBookmark?(): void;
  onHistorySearch?(): void;
  onForm?(): void;
}

export interface KeyboardOptions {
  isActive?: boolean;
}

/** Wraps Ink useInput and dispatches to named key handlers. */
export function useKeyboard(handlers: KeyHandlers, options?: KeyboardOptions): void {
  useInput((input, key) => {
    if (input === 'e' && key.ctrl) {
      handlers.onExport?.();
      return;
    }
    if (input === 'r' && key.ctrl) {
      handlers.onHistorySearch?.();
      return;
    }
    if (key.tab) {
      handlers.onTab?.();
      return;
    }
    if (key.return) {
      handlers.onEnter?.();
      return;
    }
    if (key.escape) {
      handlers.onEscape?.();
      return;
    }
    if (input >= '1' && input <= '9' && handlers.onSwitchTab) {
      handlers.onSwitchTab(parseInt(input, 10) - 1);
      return;
    }
    switch (input) {
      case 'k':
        handlers.onUp?.();
        return;
      case 'j':
        handlers.onDown?.();
        return;
      case 'h':
        handlers.onBack?.();
        return;
      case 'l':
        handlers.onForward?.();
        return;
      case 'r':
        handlers.onReload?.();
        return;
      case 'g':
        handlers.onGoUrl?.();
        return;
      case 't':
        handlers.onNewTab?.();
        return;
      case 'w':
        handlers.onCloseTab?.();
        return;
      case 'f':
        handlers.onLinkHints?.();
        return;
      case 'B':
        handlers.onBookmark?.();
        return;
      case 'F':
        handlers.onForm?.();
        return;
      case 'o':
        handlers.onOpen?.();
        return;
      case 'q':
        handlers.onQuit?.();
        return;
      case '/':
        handlers.onFilter?.();
        return;
      case 's':
        handlers.onStats?.();
        return;
    }
  }, { isActive: options?.isActive });
}
