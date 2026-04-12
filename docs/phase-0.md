# Phase 0: MCP Server

**期間**: 2026-04-12  
**Commits**: `48e1ae6` scaffold, `027d1e2` MCP server

## 目標

Claude Code に接続して search と fetch のログが stderr に流れる最小実装。TUI なし。

## 成果物

- **MCP server** (stdio transport): `search` + `fetch` の 2 ツール
- **search**: Brave Search API (`X-Subscription-Token` 認証、count clamp [1,20])
- **fetch**: Axios + Turndown (HTML→Markdown、script/style 除去)
- **zod validation**: MCP trust boundary で引数を safeParse
- **stderr logging**: `[search] query: ...` / `[fetch] url: ...` 形式

## 技術的判断

| 判断 | 理由 |
|------|------|
| Token count = `Math.ceil(len/4)` | tiktoken 依存を避ける。Phase 2 以降で改善可 |
| `fetch.prompt` は accept only | Phase 0 scope。LLM 処理は Phase 2+ |
| Content truncation なし | Phase 0 は全文返却。Phase 2 で制限追加 |
| stderr ad-hoc format | Phase 1 で TUI に置き換え予定 |

## テスト

24 tests / 5 suites:
- `config.test.ts` (2) — env 読み込み
- `search.test.ts` (5+1) — API call, count clamp, missing key, error, stderr, IPC
- `fetch.test.ts` (5+1) — HTML→MD, script strip, error, stderr, prompt, IPC
- `htmlToText.test.ts` (5) — 見出し, script, style, list, code block
- `server.test.ts` (5+2) — listTools, dispatch, unknown, invalid args
