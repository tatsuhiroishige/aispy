# Claude Code Integration Guide

## Prerequisites

- Node.js >= 20.19 (recommended) or 20.18+ with `--experimental-require-module` flag
- aispy built locally (`npm run build`)
- Brave Search API key ([brave.com/search/api](https://brave.com/search/api) -- free tier: 2,000 queries/month)

## Setup

### 1. Clone and build aispy

```bash
git clone https://github.com/tatsu/aispy.git
cd aispy
npm install
npm run build
```

### 2. Configure your API key

Create a `.env` file in the aispy root directory:

```bash
echo 'BRAVE_API_KEY=your-brave-api-key-here' > .env
```

### 3. Add aispy to Claude Code

Edit `~/.claude.json` and add the `mcpServers` entry:

```json
{
  "mcpServers": {
    "aispy": {
      "command": "node",
      "args": [
        "--experimental-require-module",
        "/absolute/path/to/aispy/dist/index.js",
        "--mcp"
      ],
      "env": {
        "BRAVE_API_KEY": "your-brave-api-key-here"
      }
    }
  }
}
```

Replace `/absolute/path/to/aispy` with your actual path (e.g., `/Users/you/Development/aispy`).

The `--experimental-require-module` flag is required on Node < 22 (jsdom 27 uses ESM-only deps). On Node >= 22, the flag is unnecessary. The `env` block passes the API key to the MCP child process; omit it if `BRAVE_API_KEY` is already in your shell environment.

### 4. Start aispy TUI + Claude Code in tmux

Open two tmux panes (or two terminal tabs):

```bash
# Pane 1: aispy TUI
cd /path/to/aispy && node --experimental-require-module dist/index.js

# Pane 2: Claude Code
claude
```

### 5. Verify the connection

1. The TUI StatusBar should show `● connected` once Claude Code launches the MCP child process.
2. Ask Claude Code to search the web (e.g., "search for the latest Node.js release notes").
3. You should see search queries and fetch events appear in the Activity Log (left pane).
4. Select an entry with `Enter` to preview the page content in the Page Viewer (right pane).

If the StatusBar says "Waiting for events", see Troubleshooting below.

## Configuration

aispy currently uses Brave Search as its search backend. The API key is configured via environment variable:

| Variable | Required | Description |
|---|---|---|
| `BRAVE_API_KEY` | Yes | Brave Search API key |

Future releases will add support for alternative backends (Serper, Tavily) via a `SEARCH_BACKEND` setting.

## Troubleshooting

### `ERR_REQUIRE_ESM` on startup

jsdom 27's dependency chain is ESM-only. Add `--experimental-require-module` to the `args` array in `~/.claude.json`, or upgrade to Node >= 22 where `require(esm)` is stable.

### "BRAVE_API_KEY is not set"

The MCP child process cannot see your API key. Either:
- Add it to the `env` block in `~/.claude.json` (see Step 3), or
- Set it in your `.env` file in the aispy project root, or
- Export it in your shell before starting Claude Code: `export BRAVE_API_KEY=...`

### TUI shows "Waiting for events" but Claude Code is searching

- **Socket path mismatch**: Both processes must use the same socket at `/tmp/aispy-<username>.sock`. Verify with `ls /tmp/aispy-*.sock`.
- **MCP not registered**: Confirm the `mcpServers.aispy` entry exists in `~/.claude.json` and restart Claude Code.
- **Claude Code using built-in search**: If aispy's MCP tools are registered, Claude Code should prefer them over built-in WebSearch/WebFetch. Check that the `--mcp` flag is included in the args.

### Socket permission errors

If a previous session crashed, a stale socket may remain. Remove it and restart:

```bash
rm /tmp/aispy-$(whoami).sock
```

## How It Works

aispy runs as two cooperating processes:

1. **`aispy --mcp`** (MCP server) -- Claude Code spawns this as a child process via stdio. It receives `search` and `fetch` tool calls over JSON-RPC, executes them (Brave API for search, Axios + Readability for fetch), returns results to Claude Code, and simultaneously forwards events over a Unix domain socket.

2. **`aispy`** (TUI) -- You start this manually. It listens on `/tmp/aispy-<username>.sock` for events from the MCP process and renders them in an Ink-based terminal UI with an Activity Log, Page Viewer, and StatusBar.

Claude Code sees aispy as a standard MCP tool provider. The TUI visualization is a side effect -- the AI does not need to know about it.
