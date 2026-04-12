# Phase 4: プロダクション品質

**期間**: 2026-04-12
**Commit**: `02c396f`

## 目標

npm publish 準備、複数検索バックエンド対応、セッションエクスポート、Claude Code 接続。

## 成果物

### npm publish 準備
- `package.json` に metadata 追加 (keywords, license, repository, files, engines)
- `LICENSE` (MIT)
- `README.md` (プロジェクトルート): 機能一覧、Quick Start、Claude Code 設定、キーバインド表
- `npm pack --dry-run` で tarball に `dist/`, `README.md`, `LICENSE` のみ含まれることを確認

### 複数検索バックエンド
`SEARCH_BACKEND` 環境変数で切り替え (default: `brave`):

| Backend | API | 無料枠 | 環境変数 |
|---------|-----|--------|---------|
| Brave | `api.search.brave.com` | $5/月クレジット (~1,000回) | `BRAVE_API_KEY` |
| Serper | `google.serper.dev` (Google 結果) | 2,500/月 | `SERPER_API_KEY` |
| Tavily | `api.tavily.com` (AI 検索) | 1,000/月 | `TAVILY_API_KEY` |

アーキテクチャ:
```
src/search/
├── types.ts     # SearchBackend interface
├── brave.ts     # Brave Search API
├── serper.ts    # Serper (Google)
├── tavily.ts    # Tavily (AI search)
└── index.ts     # createSearchBackend() factory
```

`src/mcp/tools/search.ts` は backend を直接知らない。`createSearchBackend(config)` で抽象化。

### セッションエクスポート
- `Ctrl+E` で JSON + Markdown を同時出力
- ファイル名: `aispy-session-YYYYMMDD-HHmmss.{json,md}`
- JSON: `{ exportedAt, stats, events }` (machine-readable)
- Markdown: タイムスタンプ付き Activity Log + stats summary (human-readable)

### Claude Code 接続
- `scripts/aispy-mcp.sh` ラッパースクリプト (.env 自動読み込み + `--experimental-require-module`)
- `claude mcp add aispy -- /path/to/scripts/aispy-mcp.sh` で登録
- `docs/claude-code-integration.md` にセットアップガイド

## 動作確認結果 (2026-04-12)

Claude Code から aispy 経由で:
- Brave Search API で検索 ✓
- 論文サイト (arxiv.org) fetch + Readability 抽出 ✓
- 天気予報サイト fetch ✓
- 株価情報サイト fetch ✓
- TUI にリアルタイム表示 ✓
- read/skip labels retroactive 更新 ✓
- auto-open / auto-close の画面遷移 ✓

## テスト

124 tests / 25 suites
