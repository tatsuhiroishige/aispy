import fs from 'node:fs';
import path from 'node:path';
import type { AispyEvent } from '../types.js';
import { aispyEventSchema } from '../ipc/protocol.js';

const SESSION_FILENAME = '.aispy-session.jsonl';

export function getSessionPath(): string {
  return path.join(process.cwd(), SESSION_FILENAME);
}

export function saveEvent(event: AispyEvent): void {
  fs.appendFileSync(getSessionPath(), JSON.stringify(event) + '\n');
}

export function loadSession(): AispyEvent[] {
  const filePath = getSessionPath();
  let content: string;
  try {
    content = fs.readFileSync(filePath, 'utf-8');
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    throw err;
  }

  const events: AispyEvent[] = [];
  const lines = content.split('\n');
  for (const line of lines) {
    if (line.length === 0) continue;
    try {
      const parsed: unknown = JSON.parse(line);
      const event = aispyEventSchema.parse(parsed);
      events.push(event);
    } catch {
      // skip invalid lines
    }
  }
  return events;
}

export function clearSession(): void {
  const filePath = getSessionPath();
  try {
    fs.writeFileSync(filePath, '');
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return;
    }
    throw err;
  }
}
