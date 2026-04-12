# aispy

AI Search Process Visualizer -- an MCP server + terminal UI that lets humans
watch what AI is searching and reading on the web in real time.

```
tmux
+------- pane 1 --------+   +------- pane 2 --------+
|  Claude Code           |   |  $ aispy              |
|    spawns:             |   |  +------------------+ |
|  +------------------+  |   |  | Activity   Page  | |
|  | aispy --mcp      |--IPC-->| Log    | Viewer  | |
|  | (stdio MCP)      |  |   |  |          |       | |
|  | search / fetch   |  |   |  |          |       | |
|  +------------------+  |   |  | Status Bar       | |
|    stdin/stdout         |   |  +------------------+ |
|    JSON-RPC            |   |                        |
+------------------------+   +------------------------+
```

The TUI runs in one tmux pane. Claude Code (or any MCP client) spawns a
second `aispy --mcp` process in another pane. Every search query and page
fetch streams through a Unix socket to the TUI so you can see exactly what
the AI is doing.

## Features

- **Search visualization** -- every query appears in the activity log with
  result count, backend, and timing
- **Page viewer** -- fetched pages are converted to clean text (Readability +
  Turndown) and displayed in a scrollable pane
- **Keybindings** -- vim-style navigation, tab to switch panes, `/` to
  filter, `o` to open in browser
- **ANSI color** -- search results, status indicators, and highlights render
  in full color
- **Cache** -- fetched pages are cached to avoid redundant requests
- **Filter** -- live-filter the activity log by keyword
- **Stats** -- press `s` to see aggregate statistics (queries, fetches,
  cache hits, timings)

## Quick start

```bash
# 1. Install
npm install -g aispy

# 2. Set up your API key
echo 'BRAVE_API_KEY=your-key-here' > .env

# 3. Run the TUI
aispy
```

If running from source:

```bash
git clone https://github.com/tatsuhiroishige/aispy.git
cd aispy
npm install
npm run build
node --experimental-require-module dist/index.js
```

## Claude Code configuration

### Recommended: wrapper script

The simplest setup uses the included wrapper script, which handles `.env`
loading and the `--experimental-require-module` flag automatically:

```bash
# Register with Claude Code
claude mcp add aispy -- /path/to/aispy/scripts/aispy-mcp.sh
```

### Alternative: manual JSON config

Add this to your Claude Code MCP settings (`~/.claude.json` project config):

```json
{
  "mcpServers": {
    "aispy": {
      "command": "node",
      "args": [
        "--experimental-require-module",
        "/path/to/aispy/dist/index.js",
        "--mcp"
      ],
      "env": {
        "BRAVE_API_KEY": "your-key-here"
      }
    }
  }
}
```

### Usage

1. Start the TUI in a tmux pane: `node --experimental-require-module dist/index.js`
2. Start Claude Code in another pane: `claude`
3. Ask Claude to search or research something
4. Watch the TUI update in real time -- search queries, results, fetched pages

The startup order doesn't matter. The IPC client auto-reconnects every 3
seconds until the TUI is available.

## Keybindings

| Key     | Action                         |
|---------|--------------------------------|
| Tab     | Switch between left/right pane |
| j / k   | Scroll down / up               |
| Enter   | Preview selected entry         |
| o       | Open in browser                |
| /       | Filter activity log            |
| s       | Show stats modal               |
| Escape  | Close filter / modal           |
| q       | Go back / quit                 |

## Search backends

aispy supports three search backends, configured via the `SEARCH_BACKEND`
environment variable (defaults to `brave`):

| Backend | Env var          | `SEARCH_BACKEND` value |
|---------|------------------|------------------------|
| Brave   | `BRAVE_API_KEY`  | `brave`                |
| Serper  | `SERPER_API_KEY` | `serper`               |
| Tavily  | `TAVILY_API_KEY` | `tavily`               |

Set the appropriate API key for your chosen backend in `.env` or via the
environment.

## MCP tools

aispy exposes two MCP tools:

- **search** -- run a web search query and return results
- **fetch** -- fetch a URL, extract readable content, and return clean text

## Requirements

- Node.js >= 20.19.0 or >= 22.0.0
- An API key for your chosen search backend (Brave, Serper, or Tavily)

## License

[MIT](LICENSE)
