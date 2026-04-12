import { describe, it, expect, afterEach } from 'vitest';
import net from 'node:net';
import fs from 'node:fs';
import { createIpcClient } from './client.js';
import { deserializeEvent } from './protocol.js';
import type { AispyEvent } from '../types.js';

function uniqueSocketPath(): string {
  return `/tmp/aispy-test-client-${Date.now()}-${Math.random().toString(36).slice(2)}.sock`;
}

const searchEvent: AispyEvent = {
  type: 'search',
  timestamp: 1712000000000,
  query: 'vitest testing',
  count: 1,
  results: [
    { title: 'Vitest', url: 'https://vitest.dev', snippet: 'Fast testing' },
  ],
};

function waitForConnection(
  server: net.Server,
): Promise<net.Socket> {
  return new Promise((resolve) => {
    server.once('connection', resolve);
  });
}

function startServer(socketPath: string): Promise<net.Server> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.on('error', reject);
    server.listen(socketPath, () => resolve(server));
  });
}

function closeServer(server: net.Server): Promise<void> {
  return new Promise((resolve) => {
    server.close(() => resolve());
  });
}

function collectData(socket: net.Socket): Promise<string> {
  return new Promise((resolve) => {
    let buf = '';
    socket.on('data', (chunk) => {
      buf += chunk.toString();
    });
    socket.on('end', () => resolve(buf));
    socket.on('close', () => resolve(buf));
  });
}

const cleanupPaths: string[] = [];
const cleanupServers: net.Server[] = [];

afterEach(async () => {
  for (const server of cleanupServers) {
    await closeServer(server).catch(() => {});
  }
  cleanupServers.length = 0;

  for (const p of cleanupPaths) {
    try {
      fs.unlinkSync(p);
    } catch {
      // already gone
    }
  }
  cleanupPaths.length = 0;
});

describe('IpcClient', () => {
  it('connects and delivers events to a listening server', async () => {
    const socketPath = uniqueSocketPath();
    cleanupPaths.push(socketPath);

    const server = await startServer(socketPath);
    cleanupServers.push(server);

    const connPromise = waitForConnection(server);
    const client = createIpcClient(socketPath);

    const serverSocket = await connPromise;
    const dataPromise = collectData(serverSocket);

    // Small delay to ensure the client's 'connect' event has fired
    await new Promise((r) => setTimeout(r, 50));

    client.send(searchEvent);
    client.close();

    const raw = await dataPromise;
    const lines = raw.trim().split('\n');
    expect(lines).toHaveLength(1);

    const received = deserializeEvent(lines[0]!);
    expect(received).toEqual(searchEvent);
  });

  it('returns without throwing when no server exists, send() is a no-op', async () => {
    const socketPath = `/tmp/aispy-test-no-server-${Date.now()}.sock`;
    cleanupPaths.push(socketPath);

    const client = createIpcClient(socketPath);

    // Wait for the connection error to fire
    await new Promise((r) => setTimeout(r, 100));

    expect(() => client.send(searchEvent)).not.toThrow();
    client.close();
  });

  it('close() disconnects cleanly', async () => {
    const socketPath = uniqueSocketPath();
    cleanupPaths.push(socketPath);

    const server = await startServer(socketPath);
    cleanupServers.push(server);

    const connPromise = waitForConnection(server);
    const client = createIpcClient(socketPath);

    const serverSocket = await connPromise;
    await new Promise((r) => setTimeout(r, 50));

    const closedPromise = new Promise<void>((resolve) => {
      serverSocket.on('close', () => resolve());
    });

    client.close();
    await closedPromise;

    // After close, send should not throw
    expect(() => client.send(searchEvent)).not.toThrow();
  });

  it('send() does not throw after server drops', async () => {
    const socketPath = uniqueSocketPath();
    cleanupPaths.push(socketPath);

    const server = await startServer(socketPath);
    cleanupServers.push(server);

    const connPromise = waitForConnection(server);
    const client = createIpcClient(socketPath);

    const serverSocket = await connPromise;
    await new Promise((r) => setTimeout(r, 50));

    // Destroy the server-side socket so the client sees a close
    serverSocket.destroy();
    await closeServer(server);
    cleanupServers.length = 0;

    // Wait for the close event to propagate
    await new Promise((r) => setTimeout(r, 100));

    expect(() => client.send(searchEvent)).not.toThrow();
    client.close();
  });
});
