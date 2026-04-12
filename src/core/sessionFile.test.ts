import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AispyEvent } from '../types.js';
import { saveEvent, loadSession, clearSession, getSessionPath } from './sessionFile.js';

let tmpDir: string;
let originalCwd: () => string;

const searchEvent: AispyEvent = {
  type: 'search',
  timestamp: 1712000000000,
  query: 'vitest testing',
  count: 1,
  results: [
    { title: 'Vitest', url: 'https://vitest.dev', snippet: 'Fast testing' },
  ],
};

const fetchEvent: AispyEvent = {
  type: 'fetch',
  timestamp: 1712000001000,
  url: 'https://example.com',
  content: 'page content',
  tokens: 42,
  durationMs: 200,
};

describe('sessionFile', () => {
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aispy-session-test-'));
    originalCwd = process.cwd;
    process.cwd = () => tmpDir;
  });

  afterEach(() => {
    process.cwd = originalCwd;
    try {
      fs.rmSync(tmpDir, { recursive: true });
    } catch {
      // already cleaned up
    }
  });

  it('getSessionPath returns .aispy-session.jsonl in cwd', () => {
    expect(getSessionPath()).toBe(path.join(tmpDir, '.aispy-session.jsonl'));
  });

  it('saveEvent + loadSession roundtrip', () => {
    saveEvent(searchEvent);
    saveEvent(fetchEvent);

    const loaded = loadSession();
    expect(loaded).toHaveLength(2);
    expect(loaded[0]).toEqual(searchEvent);
    expect(loaded[1]).toEqual(fetchEvent);
  });

  it('loadSession returns empty array when no file exists', () => {
    const loaded = loadSession();
    expect(loaded).toEqual([]);
  });

  it('clearSession empties the file', () => {
    saveEvent(searchEvent);
    saveEvent(fetchEvent);

    clearSession();

    const loaded = loadSession();
    expect(loaded).toEqual([]);

    const content = fs.readFileSync(getSessionPath(), 'utf-8');
    expect(content).toBe('');
  });

  it('invalid lines are skipped', () => {
    saveEvent(searchEvent);
    fs.appendFileSync(getSessionPath(), 'not valid json\n');
    fs.appendFileSync(getSessionPath(), '{"type":"unknown","foo":1}\n');
    saveEvent(fetchEvent);

    const loaded = loadSession();
    expect(loaded).toHaveLength(2);
    expect(loaded[0]).toEqual(searchEvent);
    expect(loaded[1]).toEqual(fetchEvent);
  });
});
