# aispy — 開発ドキュメント

## 目次

- [architecture.md](architecture.md) — 2 プロセス構成、IPC、データフロー
- [phase-0.md](phase-0.md) — Phase 0: MCP server 実装
- [phase-1.md](phase-1.md) — Phase 1: Ink TUI + IPC
- [phase-2.md](phase-2.md) — Phase 2: コンテンツ品質 + UI 拡張
- [known-issues.md](known-issues.md) — 既知の課題と次の改善候補

## 現在の状態

- **Phase 2 完了** (2026-04-12)
- Commit 9 つ: scaffold → MCP → TUI → fixes → Phase 2 → bugfixes
- Test: 98 pass / 21 suites
- 全機能動作確認済み: search, fetch, cache, read/skip, filter, stats, ANSI color

## 使い方

```bash
# .env に API key を設定
echo 'BRAVE_API_KEY=your-key' > .env

# ビルド
npm run build

# tmux pane 1: TUI
node --experimental-require-module dist/index.js

# tmux pane 2: Claude Code (MCP 設定済み) or 手動テスト
bash scripts/test-search.sh
bash scripts/test-multi-fetch.sh
bash scripts/test-cache.sh
```

## Claude Code 設定

```json
{
  "mcpServers": {
    "aispy": {
      "command": "node",
      "args": ["--experimental-require-module", "/path/to/aispy/dist/index.js", "--mcp"],
      "env": { "BRAVE_API_KEY": "your-key" }
    }
  }
}
```

## キーバインド

| Key | Action |
|-----|--------|
| Tab | 左右ペイン切替 |
| j/k | スクロール |
| Enter | 選択エントリをプレビュー |
| o | ブラウザで開く |
| / | ログフィルタ |
| s | stats modal |
| Escape | filter/modal 解除 |
| q | 戻る / 終了 |
