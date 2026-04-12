import { afterEach, describe, expect, it, vi } from 'vitest';
import net from 'node:net';
import fs from 'node:fs/promises';
import { createIpcServer } from './server.js';
import { serializeEvent } from './protocol.js';
import type { AispyEvent } from '../types.js';

let socketPathOverride: string;
let cleanup: (() => Promise<void>) | undefined;

vi.mock('./protocol.js', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('./protocol.js')>();
  return {
    ...original,
    getSocketPath: () => socketPathOverride,
  };
});

function uniqueSocketPath(): string {
  return `/tmp/aispy-test-${Date.now()}-${Math.random().toString(36).slice(2)}.sock`;
}

function connectClient(sockPath: string): Promise<net.Socket> {
  return new Promise((resolve, reject) => {
    const client = net.createConnection(sockPath, () => resolve(client));
    client.on('error', reject);
  });
}

function writeAndDrain(socket: net.Socket, data: string): Promise<void> {
  return new Promise((resolve, reject) => {
    socket.write(data, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function waitForEvents(
  events: AispyEvent[],
  count: number,
  timeoutMs = 2000,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Timed out waiting for ${count} events (got ${events.length})`)),
      timeoutMs,
    );
    const check = () => {
      if (events.length >= count) {
        clearTimeout(timer);
        resolve();
      } else {
        setTimeout(check, 10);
      }
    };
    check();
  });
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

const fetchStartEvent: AispyEvent = {
  type: 'fetch-start',
  timestamp: 1712000001000,
  url: 'https://vitest.dev',
};

afterEach(async () => {
  if (cleanup) {
    await cleanup();
    cleanup = undefined;
  }
  try {
    await fs.unlink(socketPathOverride);
  } catch {
    // already cleaned up
  }
});

describe('IPC server', () => {
  it('receives a single event from a client', async () => {
    socketPathOverride = uniqueSocketPath();
    const received: AispyEvent[] = [];
    const ipc = await createIpcServer((event) => received.push(event));
    cleanup = ipc.close;

    const client = await connectClient(socketPathOverride);
    await writeAndDrain(client, serializeEvent(searchEvent));

    await waitForEvents(received, 1);
    expect(received).toHaveLength(1);
    expect(received[0]).toEqual(searchEvent);
    client.destroy();
  });

  it('receives two events sent in one chunk', async () => {
    socketPathOverride = uniqueSocketPath();
    const received: AispyEvent[] = [];
    const ipc = await createIpcServer((event) => received.push(event));
    cleanup = ipc.close;

    const client = await connectClient(socketPathOverride);
    const twoLines = serializeEvent(searchEvent) + serializeEvent(fetchStartEvent);
    await writeAndDrain(client, twoLines);

    await waitForEvents(received, 2);
    expect(received).toHaveLength(2);
    expect(received[0]).toEqual(searchEvent);
    expect(received[1]).toEqual(fetchStartEvent);
    client.destroy();
  });

  it('reassembles a partial line split across two chunks', async () => {
    socketPathOverride = uniqueSocketPath();
    const received: AispyEvent[] = [];
    const ipc = await createIpcServer((event) => received.push(event));
    cleanup = ipc.close;

    const client = await connectClient(socketPathOverride);
    const full = serializeEvent(searchEvent);
    const mid = Math.floor(full.length / 2);

    await writeAndDrain(client, full.slice(0, mid));
    await new Promise((r) => setTimeout(r, 50));
    await writeAndDrain(client, full.slice(mid));

    await waitForEvents(received, 1);
    expect(received).toHaveLength(1);
    expect(received[0]).toEqual(searchEvent);
    client.destroy();
  });

  it('logs invalid JSON to stderr and continues processing', async () => {
    socketPathOverride = uniqueSocketPath();
    const received: AispyEvent[] = [];
    const ipc = await createIpcServer((event) => received.push(event));
    cleanup = ipc.close;

    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    const client = await connectClient(socketPathOverride);
    await writeAndDrain(client, 'not valid json\n');
    await writeAndDrain(client, serializeEvent(searchEvent));

    await waitForEvents(received, 1);
    expect(stderrSpy).toHaveBeenCalledWith(
      expect.stringContaining('[aispy] invalid IPC message:'),
    );
    expect(received).toHaveLength(1);
    expect(received[0]).toEqual(searchEvent);

    stderrSpy.mockRestore();
    client.destroy();
  });

  it('close() removes the socket file and resolves', async () => {
    socketPathOverride = uniqueSocketPath();
    const ipc = await createIpcServer(() => {});

    await fs.access(socketPathOverride);

    await ipc.close();
    cleanup = undefined;

    await expect(fs.access(socketPathOverride)).rejects.toThrow();
  });
});
