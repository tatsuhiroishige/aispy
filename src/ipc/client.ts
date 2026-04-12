import net from 'node:net';
import type { AispyEvent } from '../types.js';
import { getSocketPath, serializeEvent } from './protocol.js';

export interface IpcClient {
  send(event: AispyEvent): void;
  close(): void;
}

const RETRY_INTERVAL_MS = 3000;

export function createIpcClient(socketPath?: string): IpcClient {
  let socket: net.Socket | null = null;
  let connected = false;
  let closed = false;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;

  const resolvedPath = socketPath ?? getSocketPath();

  function tryConnect(): void {
    if (closed) return;

    const conn = net.createConnection(resolvedPath);

    conn.on('connect', () => {
      socket = conn;
      connected = true;
      process.stderr.write('[aispy] TUI connected\n');
    });

    conn.on('error', () => {
      socket = null;
      connected = false;
      scheduleRetry();
    });

    conn.on('close', () => {
      socket = null;
      connected = false;
      scheduleRetry();
    });
  }

  function scheduleRetry(): void {
    if (closed || retryTimer) return;
    retryTimer = setTimeout(() => {
      retryTimer = null;
      tryConnect();
    }, RETRY_INTERVAL_MS);
  }

  tryConnect();

  return {
    send(event: AispyEvent): void {
      if (!socket || !connected) return;
      socket.write(serializeEvent(event));
    },

    close(): void {
      closed = true;
      if (retryTimer) {
        clearTimeout(retryTimer);
        retryTimer = null;
      }
      if (socket) {
        socket.destroy();
        socket = null;
        connected = false;
      }
    },
  };
}
