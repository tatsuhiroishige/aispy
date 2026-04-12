# 既知の課題と改善候補

## 解決済み (Phase 1.5 + Phase 2)

- ~~P1: StatusBar truncation~~ → responsive format 実装済み
- ~~P2: キーバインドヘルプ~~ → context-sensitive key hints 実装済み
- ~~P3: formatTime 重複~~ → `src/ui/formatTime.ts` に抽出済み
- ~~P4: FetchStartEvent Enter~~ → Enter guard 実装済み
- ~~Phase 2 全項目~~ → readability, ANSI color, cache, filter, stats, read/skip 実装済み

## 未解決

### P5: Node.js engine warning
- **症状**: ESLint 10 が Node ≥ 20.19 を要求。ローカル Node は 20.18.3
- **影響**: 動作はする。engine warning が出るだけ
- **対応案**: Node アップデート

### P6: `--experimental-require-module` が必要
- **症状**: jsdom 27 の dep chain が ESM only。フラグなしで起動すると `ERR_REQUIRE_ESM`
- **影響**: `node dist/index.js` ではなく `node --experimental-require-module dist/index.js` で起動する必要
- **対応案**: Node 22+ にアップデート (require(esm) が stable)、または jsdom を lazy import に変更

### P7: 長時間 session での elapsedMs 精度
- **症状**: StatusBar の elapsed time が session 開始からの経過で、`Date.now() - startTime` を毎回計算
- **影響**: 表示上だけの問題。長時間 session で秒数が大きくなる (e.g., 2076.0s)
- **対応案**: MM:SS 形式に変換、または idle 時間を除外

## Phase 3 候補 (spec §6)

- [ ] CSS layout 対応 TUI レンダリング (Chawan 級)
- [ ] CSS パーサー + スタイル解決
- [ ] yoga-layout ベースの flexbox
- [ ] ボックス描画文字によるボーダー

## Phase 4 候補 (spec §6)

- [ ] npm 公開 (`npm install -g aispy`)
- [ ] 複数検索バックエンド (Brave, Serper, Tavily 切り替え)
- [ ] 複数 AI クライアント検証 (Claude Code, Cursor, Gemini CLI)
- [ ] セッションエクスポート (JSON/Markdown)
- [ ] ドキュメント + サンプルワークフロー
