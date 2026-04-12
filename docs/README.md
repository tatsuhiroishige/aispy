# aispy — 開発ドキュメント

## 目次

- [architecture.md](architecture.md) — 2 プロセス構成、IPC、データフロー
- [phase-0.md](phase-0.md) — Phase 0: MCP server 実装
- [phase-1.md](phase-1.md) — Phase 1: Ink TUI + IPC
- [known-issues.md](known-issues.md) — 既知の課題と次の改善候補

## 現在の状態

- **Phase 1 完了** (2026-04-12)
- Commit 3 つ: scaffold → MCP server → TUI + IPC
- Test: 70 pass / 16 suites
- 動作確認済み: tmux 2 pane で TUI + MCP 接続、fetch 3 件、キーバインド全動作

## 使い方

```bash
# tmux pane 1: TUI
node dist/index.js

# tmux pane 2: Claude Code (MCP 設定済み)
claude

# または手動テスト
bash scripts/test-mcp.sh
bash scripts/test-multi-fetch.sh
```

## Claude Code 設定

```json
{
  "mcpServers": {
    "aispy": {
      "command": "aispy",
      "args": ["--mcp"],
      "env": { "BRAVE_API_KEY": "your-key" }
    }
  }
}
```
