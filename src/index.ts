#!/usr/bin/env -S node --experimental-require-module
import { startMcpServer } from './mcp-server.js';
import { startTui } from './tui.js';
import { createIpcClient } from './ipc/client.js';

const isMcpMode = process.argv.includes('--mcp');

if (isMcpMode) {
  const client = createIpcClient();
  startMcpServer(client).catch((err) => {
    process.stderr.write(
      `[aispy] fatal: ${err instanceof Error ? err.message : String(err)}\n`,
    );
    process.exit(1);
  });
} else {
  startTui().catch((err) => {
    process.stderr.write(
      `[aispy] fatal: ${err instanceof Error ? err.message : String(err)}\n`,
    );
    process.exit(1);
  });
}
