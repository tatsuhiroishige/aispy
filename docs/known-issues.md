# 既知の課題と改善候補

## 解決済み

- ~~P1: StatusBar truncation~~ → responsive format 実装済み
- ~~P2: キーバインドヘルプ~~ → context-sensitive key hints 実装済み
- ~~P3: formatTime 重複~~ → `src/ui/formatTime.ts` に抽出済み
- ~~P4: FetchStartEvent Enter~~ → Enter guard 実装済み
- ~~Phase 2 全項目~~ → readability, ANSI color, cache, filter, stats, read/skip
- ~~Phase 4 全項目~~ → multi-backend, session export, npm prep
- ~~左ペインの表示崩れ~~ → full-width + overlay レイアウトに変更
- ~~IPC 起動順序依存~~ → auto-reconnect (3 秒 retry)
- ~~StatsModal タイトル truncate~~ → padding 修正
- ~~store.getEvents() 参照問題~~ → shallow copy
- ~~ESM 互換性~~ → `--experimental-require-module`
- ~~dotenv 未対応~~ → config.ts に dotenv 統合

## 未解決

### P5: Node.js engine warning
- **症状**: ESLint 10 が Node ≥ 20.19 を要求。ローカル Node は 20.18.3
- **影響**: 動作はする。engine warning が出るだけ
- **対応案**: Node アップデート

### P6: `--experimental-require-module` が必要
- **症状**: jsdom 27 の dep chain が ESM only。フラグなしで `ERR_REQUIRE_ESM`
- **対応案**: Node 22+ (require(esm) stable)、または jsdom lazy import

### P7: 長時間 session での elapsedMs 表示
- **症状**: 秒数が大きくなる (e.g., 2076.0s)
- **対応案**: MM:SS 形式に変換

### P8: SPA ページの fetch が中身を取れない
- **症状**: React SPA (code.claude.com 等) は JS 実行前の空 HTML しか取得できない
- **影響**: PageViewer に JSX テンプレートが表示される
- **対応案**: `o` でブラウザに逃がす (設計の安全弁)。将来的には Headless browser or Jina Reader API

### P9: 大きなページの fetch でトークン超過
- **症状**: GitHub README 等で 90K+ 文字の結果が返り、MCP result size 制限に引っかかる
- **対応案**: content truncation (spec §5.2 の 100K/50K 制限を参考に実装)

## Phase 3 候補 (spec §6)

- [ ] CSS layout 対応 TUI レンダリング (Chawan 級)
- [ ] CSS パーサー + スタイル解決
- [ ] yoga-layout ベースの flexbox
- [ ] ボックス描画文字によるボーダー

## その他の改善候補

- [ ] npm publish (アカウント準備 → `npm publish`)
- [ ] 複数 AI クライアント検証 (Cursor, Gemini CLI)
- [ ] セッション永続化 (events をファイルに保存、再起動後に復元)
- [ ] `--export` CLI フラグ (非 TUI モードでの export)
- [ ] content truncation (大きなページの切り詰め)
- [ ] IPC 複数クライアント対応 (複数 Claude Code セッション同時接続)
