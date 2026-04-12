import type { AispyEvent } from '../types.js';
import type { Server as NetServer } from 'node:net';
import net from 'node:net';
import fs from 'node:fs/promises';
import { getSocketPath, deserializeEvent } from './protocol.js';

export interface IpcServer {
  server: NetServer;
  close(): Promise<void>;
}

export async function createIpcServer(
  onEvent: (event: AispyEvent) => void,
): Promise<IpcServer> {
  const socketPath = getSocketPath();

  try {
    await fs.unlink(socketPath);
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw err;
    }
  }

  const connections = new Set<net.Socket>();

  const server = net.createServer((socket) => {
    connections.add(socket);
    let buffer = '';

    socket.on('data', (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop()!;
      for (const line of lines) {
        if (line.length === 0) continue;
        try {
          const event = deserializeEvent(line);
          onEvent(event);
        } catch (err: unknown) {
          process.stderr.write(
            `[aispy] invalid IPC message: ${err instanceof Error ? err.message : String(err)}\n`,
          );
        }
      }
    });

    socket.on('close', () => {
      connections.delete(socket);
    });

    socket.on('error', () => {
      connections.delete(socket);
    });
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(socketPath, () => {
      server.removeListener('error', reject);
      resolve();
    });
  });

  async function close(): Promise<void> {
    for (const conn of connections) {
      conn.destroy();
    }
    connections.clear();

    await new Promise<void>((resolve, reject) => {
      server.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    try {
      await fs.unlink(socketPath);
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw err;
      }
    }
  }

  return { server, close };
}
