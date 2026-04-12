import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { IpcClient } from './ipc/client.js';
import { createServer } from './mcp/server.js';

export async function startMcpServer(client?: IpcClient): Promise<void> {
  const server = createServer(client);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write('[aispy] mcp server started\n');
}
