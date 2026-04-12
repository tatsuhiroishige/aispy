# Phase 1: Ink TUI + IPC

**期間**: 2026-04-12  
**Commit**: `4ddaec6`

## 目標

左右ペイン + StatusBar の TUI を Ink で実装し、MCP プロセスと IPC で接続する。

## アーキテクチャ変更

Phase 0 は単一プロセス (stdio MCP only) だったが、Phase 1 で **2 プロセス構成** に変更:
- `aispy` → TUI mode (Ink render + Unix socket listen)
- `aispy --mcp` → MCP mode (stdio + socket connect → event forward)

Spec §2.1 と §3.1 をこの設計に合わせて更新した。

## 成果物

### IPC 層 (src/ipc/)
- `protocol.ts` — JSONL serialize/deserialize + zod schema + socket path
- `server.ts` — TUI 側 socket listener (partial line buffering 対応)
- `client.ts` — MCP 側 sender (socket 不在時は silent fallback)

### Event Store (src/core/store.ts)
- `EventStore` interface: addEvent, subscribe, getEvents, getStats
- 1000 エントリ cap (oldest drop)
- SessionStats: searchCount, fetchCount, totalTokens, elapsedMs

### TUI (src/ui/)
- `App.tsx` — Root: focusPane, selectedIndex, viewerState 管理
- `ActivityLog.tsx` — 左ペイン: 時系列エントリ表示
- `PageViewer.tsx` — 右ペイン: Markdown テキスト表示
- `StatusBar.tsx` — 接続状態 + stats
- `SearchEntry.tsx` / `FetchEntry.tsx` — 個別エントリ描画
- `useEventStore.ts` — store subscribe → React state
- `useKeyboard.ts` — Ink useInput wrapper
- `StoreContext.tsx` — EventStore の React Context

### キーバインド
| Key | 動作 |
|-----|------|
| Tab | 左右ペインフォーカス切替 |
| j/k | スクロール |
| Enter | 選択エントリを PageViewer に表示 |
| o | 外部ブラウザで URL を開く |
| q | PageViewer 閉じる / TUI 終了 |

## 動作確認結果 (2026-04-12)

tmux 2 pane で検証:
- IPC 接続: ✓ (socket 経由 event 転送)
- fetch 3 件 (example.com, httpbin.org/html, iana.org): ✓
- Activity Log 時系列表示: ✓
- PageViewer Enter 表示: ✓
- j/k スクロール: ✓
- o ブラウザ起動: ✓
- q PageViewer 閉じる: ✓
- StatusBar stats 集計 (1,405 tokens): ✓

## テスト

70 tests / 16 suites (Phase 0 の 24 + 新規 46)

## Agent team 構成

| Agent | 担当 |
|-------|------|
| spec-planner | Phase 1 を 9 task に分解 |
| T1 | IPC protocol types |
| T2 | IPC server |
| T3 | IPC client |
| T4 | MCP handler → IPC wiring |
| T5 | Event store |
| T6 | Ink TUI components (16 files) |
| T7 | Browser open helper |
| T8 | Entry point argv dispatch |
| T9 | Ink/React deps install |
| code-reviewer | QA review → GO |
