# aispy — 開発ドキュメント

## 目次

- [architecture.md](architecture.md) — 2 プロセス構成、IPC、データフロー
- [phase-0.md](phase-0.md) — Phase 0: MCP server 実装
- [phase-1.md](phase-1.md) — Phase 1: Ink TUI + IPC
- [phase-2.md](phase-2.md) — Phase 2: コンテンツ品質 + UI 拡張
- [phase-4.md](phase-4.md) — Phase 4: プロダクション品質
- [ui-evolution.md](ui-evolution.md) — UI レイアウト改善の経緯
- [claude-code-integration.md](claude-code-integration.md) — Claude Code 接続ガイド
- [known-issues.md](known-issues.md) — 既知の課題と次の改善候補

## 現在の状態

- **Phase 4 完了 + UI 改善** (2026-04-12)
- Commit 14 つ
- Test: 124 pass / 25 suites
- Claude Code 接続テスト完了: 検索・fetch・TUI 連携の全パイプライン動作確認済み

## 使い方

```bash
# .env に API key を設定
echo 'BRAVE_API_KEY=your-key' > .env

# ビルド
npm run build

# tmux pane 1: TUI
node --experimental-require-module dist/index.js

# tmux pane 2: Claude Code
claude

# または手動テスト
bash scripts/test-search.sh
bash scripts/test-multi-fetch.sh
bash scripts/test-cache.sh
```

推奨: `claude mcp add aispy -- /path/to/aispy/scripts/aispy-mcp.sh` で MCP 登録。

## キーバインド

| Key | Action |
|-----|--------|
| j/k | Activity Log スクロール |
| Enter | 選択エントリを PageViewer で表示 |
| o | 外部ブラウザで URL を開く |
| / | ログフィルタ (substring 検索) |
| s | session stats modal |
| Ctrl+E | session を JSON + Markdown にエクスポート |
| Escape | filter / modal 解除 |
| q | PageViewer 閉じる / TUI 終了 |

## 動作の流れ

1. AI が検索 → Activity Log にクエリ + 結果一覧 (フルワイド)
2. AI が fetch → PageViewer が auto-open (ページ内容を全画面表示)
3. AI が次の検索 → PageViewer auto-close → 新しい検索結果表示
4. AI が別のページを fetch → PageViewer 更新 (差し替え)
5. `q` でいつでも Activity Log に戻れる
