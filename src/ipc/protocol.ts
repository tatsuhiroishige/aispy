import type { AispyEvent } from '../types.js';
import { z } from 'zod';
import os from 'node:os';
import path from 'node:path';

export function getSocketPath(): string {
  const username = os.userInfo().username;
  return path.join('/tmp', `aispy-${username}.sock`);
}

const searchResultSchema = z.object({
  title: z.string(),
  url: z.string(),
  snippet: z.string(),
});

const searchEventSchema = z.object({
  type: z.literal('search'),
  timestamp: z.number(),
  query: z.string(),
  count: z.number(),
  results: z.array(searchResultSchema),
});

const fetchStartEventSchema = z.object({
  type: z.literal('fetch-start'),
  timestamp: z.number(),
  url: z.string(),
});

const fetchEventSchema = z.object({
  type: z.literal('fetch'),
  timestamp: z.number(),
  url: z.string(),
  content: z.string(),
  tokens: z.number(),
  durationMs: z.number(),
});

export const aispyEventSchema: z.ZodType<AispyEvent> = z.discriminatedUnion(
  'type',
  [searchEventSchema, fetchStartEventSchema, fetchEventSchema],
);

export function serializeEvent(event: AispyEvent): string {
  return JSON.stringify(event) + '\n';
}

export function deserializeEvent(line: string): AispyEvent {
  const parsed: unknown = JSON.parse(line);
  return aispyEventSchema.parse(parsed);
}
