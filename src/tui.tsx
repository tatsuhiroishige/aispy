import { render } from 'ink';
import { createEventStore } from './core/store.js';
import { loadSession, saveEvent } from './core/sessionFile.js';
import { createIpcServer } from './ipc/server.js';
import { App } from './ui/App.js';

const ENTER_ALT_SCREEN = '\x1b[?1049h';
const LEAVE_ALT_SCREEN = '\x1b[?1049l';

export async function startTui(): Promise<void> {
  const store = createEventStore();

  const savedEvents = loadSession();
  for (const event of savedEvents) {
    store.addEvent(event);
  }

  const ipcServer = await createIpcServer((event) => {
    store.addEvent(event);
    saveEvent(event);
  });

  // Enter alternate screen buffer so prior terminal content (dotenvx output,
  // shell scrollback) cannot flash through during re-renders.
  process.stdout.write(ENTER_ALT_SCREEN);
  const restore = (): void => {
    process.stdout.write(LEAVE_ALT_SCREEN);
  };
  process.on('exit', restore);
  process.on('SIGINT', () => {
    restore();
    process.exit(130);
  });
  process.on('SIGTERM', () => {
    restore();
    process.exit(143);
  });

  const { waitUntilExit } = render(<App store={store} />);

  try {
    await waitUntilExit();
  } finally {
    restore();
    await ipcServer.close();
  }
}
