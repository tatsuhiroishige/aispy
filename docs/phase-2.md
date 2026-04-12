# Phase 2: コンテンツ品質 + UI 拡張

**期間**: 2026-04-12
**Commit**: `304a2fb` Phase 2 本体, `29322ca` ESM fix, `8b6b86b` StatsModal fix, `b9a7754` dotenv, `2e1eb67` store re-render fix

## 目標

Page Viewer の表示品質を実用レベルに引き上げ、TUI の操作性を拡張する。

## 成果物

### コンテンツ品質
- **@mozilla/readability** でメインコンテンツ抽出 (nav/footer/sidebar 除去)
  - iana.org: 459 → 220 tokens に削減 (52% 圧縮)
  - 非記事ページ (bare HTML) は Turndown fallback
  - URL 渡しで相対リンクを絶対リンクに解決
- **ANSI カラー** in PageViewer
  - 見出し: bold + cyan
  - リンク: blue + underline (URL は dim)
  - コードフェンス: yellow
  - 水平線: dim
- **LRU fetch cache** (src/core/fetchCache.ts)
  - 200 エントリ, 15 分 TTL
  - cache hit: HTTP スキップ, `durationMs: 0`, `FetchStartEvent` なし
  - テスト: example.com 0.4s → 0.0s

### UI 拡張
- **`/` フィルタ**: ActivityLog を substring で絞り込み。文字入力 + Backspace + Escape 解除
- **`s` stats modal**: per-search クエリ一覧, per-fetch URL + token 詳細, total, session time
- **read/skip labels**: 検索結果の URL が fetch 済み → `← read` (green), 未 fetch → `← skip` (dim)。retroactive 更新

### バグ修正
- **store.getEvents() 参照問題**: 同じ配列参照を返していたため React が re-render をスキップ → `[...events]` で shallow copy に修正
- **ESM 互換性**: jsdom 27 の transitive dep (`@csstools/css-calc`) が ESM only。`--experimental-require-module` を shebang に追加
- **StatsModal タイトル truncation**: `paddingX` 不足で "S" が border に隠れる → padding 増加
- **dotenv 統合**: `.env` から自動で `BRAVE_API_KEY` 読み込み。`source` / `export` 不要

## 動作確認結果 (2026-04-12)

| 機能 | 結果 |
|------|------|
| Brave Search API | ✓ |
| read/skip labels (retroactive) | ✓ |
| Readability コンテンツ抽出 | ✓ |
| ANSI カラー (見出し/リンク/コード) | ✓ |
| `/` フィルタ | ✓ |
| `s` stats modal | ✓ |
| fetch cache (0.4s → 0.0s) | ✓ |

## テスト

98 tests / 21 suites

## 技術的判断

| 判断 | 理由 |
|------|------|
| jsdom + Readability (not cheerio) | Readability が DOM API を要求。jsdom が唯一の選択肢 |
| `--experimental-require-module` | jsdom 27 の dep chain が ESM only。Node 20 で require(esm) に必要 |
| cache は in-memory のみ | Phase 2 scope。永続化は Phase 4 |
| filter は全文 substring | spec は "クエリで絞り込み" としか言わない。シンプルに全 event テキスト |
| Escape で modal/filter 解除 | spec §2.3 に Escape なし → spec gap として追加 |
