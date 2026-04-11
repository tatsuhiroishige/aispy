#!/usr/bin/env node
import { startMcpServer } from './mcp-server.js';

startMcpServer().catch((err) => {
  process.stderr.write(
    `[aispy] fatal: ${err instanceof Error ? err.message : String(err)}\n`,
  );
  process.exit(1);
});
