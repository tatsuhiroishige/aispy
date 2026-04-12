import { render } from 'ink';
import { createEventStore } from './core/store.js';
import { loadSession, saveEvent } from './core/sessionFile.js';
import { createIpcServer } from './ipc/server.js';
import { App } from './ui/App.js';

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

  const { waitUntilExit } = render(
    <App store={store} />,
  );

  await waitUntilExit();
  await ipcServer.close();
}
