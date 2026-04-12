import { render } from 'ink';
import { createEventStore } from './core/store.js';
import { createIpcServer } from './ipc/server.js';
import { App } from './ui/App.js';

export async function startTui(): Promise<void> {
  const store = createEventStore();

  const ipcServer = await createIpcServer((event) => {
    store.addEvent(event);
  });

  const { waitUntilExit } = render(
    <App store={store} />,
  );

  await waitUntilExit();
  await ipcServer.close();
}
