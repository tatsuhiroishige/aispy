#!/usr/bin/env node
import { writeFileSync } from 'node:fs';
import { startMcpServer } from './mcp-server.js';
import { startTui } from './tui.js';
import { createIpcClient } from './ipc/client.js';
import { loadSession } from './core/sessionFile.js';
import { createEventStore } from './core/store.js';
import { exportToJson, exportToMarkdown } from './core/exportSession.js';

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  process.stdout.write(`aispy — AI Search Process Visualizer

Usage:
  aispy              Start the TUI (Activity Log + Page Viewer)
  aispy --mcp        Start as MCP server (stdio, for Claude Code)
  aispy --export     Export saved session to JSON + Markdown
  aispy --help       Show this help

Environment:
  SEARCH_BACKEND     Search backend: brave | serper | tavily (default: brave)
  BRAVE_API_KEY      API key for Brave Search
  SERPER_API_KEY     API key for Serper (Google)
  TAVILY_API_KEY     API key for Tavily

Setup:
  claude mcp add aispy -- /path/to/aispy/scripts/aispy-mcp.sh

https://github.com/tatsuhiroishige/aispy
`);
  process.exit(0);
}

if (process.argv.includes('--export')) {
  const savedEvents = loadSession();
  if (savedEvents.length === 0) {
    process.stderr.write('[aispy] No saved session found. Run aispy with MCP first.\n');
    process.exit(1);
  }

  const store = createEventStore();
  savedEvents.forEach(e => store.addEvent(e));

  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const ts = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;

  const jsonPath = `aispy-session-${ts}.json`;
  const mdPath = `aispy-session-${ts}.md`;

  writeFileSync(jsonPath, exportToJson(savedEvents, store.getStats()));
  writeFileSync(mdPath, exportToMarkdown(savedEvents, store.getStats()));

  process.stdout.write(`Exported ${savedEvents.length} events:\n  ${jsonPath}\n  ${mdPath}\n`);
  process.exit(0);
}

const isMcpMode = process.argv.includes('--mcp');

if (isMcpMode) {
  const client = createIpcClient();
  startMcpServer(client).catch((err) => {
    process.stderr.write(
      `[aispy] fatal: ${err instanceof Error ? err.message : String(err)}\n`,
    );
    process.exit(1);
  });
} else {
  startTui().catch((err) => {
    process.stderr.write(
      `[aispy] fatal: ${err instanceof Error ? err.message : String(err)}\n`,
    );
    process.exit(1);
  });
}
