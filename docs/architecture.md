# アーキテクチャ

## 2 プロセス構成

```
tmux
┌──── pane 1 ────────────┐   ┌──── pane 2 ────────────┐
│  Claude Code           │   │  $ aispy               │
│    spawns ↓            │   │    ┌──────────────────┐ │
│  ┌──────────────────┐  │   │    │ TUI (Ink)        │ │
│  │ aispy --mcp      │──IPC──→  │ Unix socket      │ │
│  │ (stdio MCP)      │  │   │    │ listen           │ │
│  │ search/fetch     │  │   │    │ Activity Log     │ │
│  └──────────────────┘  │   │    │ Page Viewer      │ │
│    ↕ stdin/stdout      │   │    │ Status Bar       │ │
│    JSON-RPC            │   │    └──────────────────┘ │
└────────────────────────┘   └────────────────────────┘
```

### なぜ 2 プロセスか

MCP stdio transport は stdin/stdout を JSON-RPC 通信に使う。Ink TUI も stdout に描画する。同一プロセスでは stdout が衝突して MCP protocol が壊れる。stdin も MCP と Ink の useInput で競合する。

### IPC

- Transport: Unix domain socket (`/tmp/aispy-<user>.sock`)
- Protocol: newline-delimited JSON (JSONL)
- Event types: `SearchEvent`, `FetchStartEvent`, `FetchEvent`
- Fallback: socket 不在時は stderr ログのみ (TUI なしでも MCP は動作)

## データフロー

```
Claude Code → stdin → aispy --mcp → Brave API / Axios
                                   ↓
                              socket send (AispyEvent)
                                   ↓
                         aispy (TUI) → store.addEvent
                                   ↓
                         useEventStore → React re-render
                                   ↓
                         ActivityLog / PageViewer / StatusBar
```

## モジュール構成

```
src/
├── index.ts              # argv 分岐: --mcp → MCP, default → TUI
├── mcp-server.ts         # startMcpServer(client?)
├── tui.tsx               # startTui(): store + IPC server + Ink render
├── config.ts             # BRAVE_API_KEY 読み込み
├── types.ts              # SearchResult, FetchResult, AispyEvent 系
├── mcp/
│   ├── server.ts         # createServer(client?): MCP tool 登録 + zod validation
│   └── tools/
│       ├── search.ts     # SearchBackend 経由 + IPC event forward
│       └── fetch.ts      # Axios + Readability + Turndown + cache + IPC
├── search/
│   ├── types.ts          # SearchBackend interface
│   ├── brave.ts          # Brave Search API
│   ├── serper.ts         # Serper (Google)
│   ├── tavily.ts         # Tavily (AI search)
│   └── index.ts          # createSearchBackend() factory
├── ipc/
│   ├── protocol.ts       # socket path, serialize/deserialize, zod schema
│   ├── server.ts         # TUI 側 socket listener
│   └── client.ts         # MCP 側 socket sender (fallback 付き)
├── core/
│   ├── store.ts          # EventStore: addEvent, subscribe, getStats
│   ├── htmlToText.ts     # Readability + Turndown (script/style 除去)
│   ├── fetchCache.ts     # LRU cache (200 entries, 15min TTL)
│   ├── exportSession.ts  # JSON + Markdown export
│   └── browserOpen.ts    # OS 別ブラウザ起動
└── ui/
    ├── App.tsx           # Root: state + keybind wiring
    ├── types.ts          # FocusPane, ViewerState
    ├── contexts/
    │   └── StoreContext.tsx
    ├── hooks/
    │   ├── useEventStore.ts
    │   └── useKeyboard.ts
    ├── formatTime.ts     # timestamp → HH:MM:SS
    └── components/
        ├── ActivityLog.tsx   # フルワイド時系列ログ
        ├── PageViewer.tsx    # overlay + ANSI color
        ├── StatusBar.tsx     # stats + key hints
        ├── SearchEntry.tsx   # 検索結果 + read/skip
        ├── FetchEntry.tsx
        ├── FilterInput.tsx   # / filter 入力
        └── StatsModal.tsx    # s stats overlay
        └── FetchEntry.tsx
```
