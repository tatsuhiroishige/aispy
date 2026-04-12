import net from 'node:net';
import type { AispyEvent } from '../types.js';
import { getSocketPath, serializeEvent } from './protocol.js';

export interface IpcClient {
  send(event: AispyEvent): void;
  close(): void;
}

export function createIpcClient(socketPath?: string): IpcClient {
  let socket: net.Socket | null = null;
  let connected = false;
  let warnedOnce = false;

  function warnDisconnected(): void {
    if (!warnedOnce) {
      warnedOnce = true;
      process.stderr.write(
        '[aispy] TUI not connected, events will not be forwarded\n',
      );
    }
  }

  const resolvedPath = socketPath ?? getSocketPath();

  const conn = net.createConnection(resolvedPath);

  conn.on('connect', () => {
    socket = conn;
    connected = true;
  });

  conn.on('error', () => {
    socket = null;
    connected = false;
    warnDisconnected();
  });

  conn.on('close', () => {
    if (connected) {
      socket = null;
      connected = false;
      warnDisconnected();
    }
  });

  return {
    send(event: AispyEvent): void {
      if (!socket || !connected) return;
      socket.write(serializeEvent(event));
    },

    close(): void {
      if (socket) {
        socket.destroy();
        socket = null;
        connected = false;
      }
    },
  };
}
