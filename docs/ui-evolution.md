# UI レイアウト改善の経緯

aispy の TUI レイアウトは実際の使用テストを通じて 3 回改善された。

## v1: 40/60 Side-by-Side Split (Phase 1)

```
┌──────────────┐┌──────────────────────────┐
│ Activity Log ││ Page Viewer              │
│ (40%)        ││ (60%)                    │
│              ││                          │
│              ││                          │
└──────────────┘└──────────────────────────┘
```

- 左ペインに Activity Log、右ペインに PageViewer
- 問題: 左ペインが狭くて検索クエリ・結果が truncate され読めない
- 問題: 右ペインは大半が空白 (viewer を開くまで "No page selected")

## v2: 30/70 Split + Compact Display (P1-P4 Fix)

```
┌──────────┐┌────────────────────────────────┐
│ Q: Lam…  ││ Page Viewer                    │
│  1.Re… ←s││ (70%)                          │
│  2.Re… ←s││                                │
└──────────┘└────────────────────────────────┘
```

- 左ペインを 30% に縮小、テキストを積極的に truncate
- `Search:` → `Q:`, `← read` → `←r`, URL 非表示
- 問題: truncate が激しすぎて何を検索してるか分からない
- 問題: 右ペインはまだ空白が多い

## v3: Full-Width + Overlay (現在)

```
通常 (Activity Log がフルワイド):
┌─────────────────────────────────────────────────┐
│ [22:43:21] Search: "Ink React terminal latest"  │
│   1. GitHub - vadimdemedes/ink: React for...  ←s │
│   2. ink - npm                                ←s │
│   3. Building CLI tools with React using...   ←s │
│                                                  │
├──────────────────────────────────────────────────┤
│ ● 1 srch | 0 pg | [Enter] preview [q] quit      │
└──────────────────────────────────────────────────┘

Fetch 完了 → PageViewer overlay (全画面):
┌─────────────────────────────────────────────────┐
│ https://github.com/vadimdemedes/ink              │
│ ─────────────────────────────────────────────    │
│ Ink provides the same component-based UI         │
│ building experience that React offers in the     │
│ browser, but for command-line apps...            │
│                                                  │
├──────────────────────────────────────────────────┤
│ ● 1 srch | 1 pg | [j/k] scroll [o] browser [q]  │
└──────────────────────────────────────────────────┘
```

### 改善ポイント
- Activity Log がフルワイドで検索クエリ・結果タイトルが完全に読める
- PageViewer は必要な時だけ overlay で全画面表示
- **Auto-open**: FetchEvent 到着時に自動で PageViewer 表示
- **Auto-close**: 新しい SearchEvent 到着時に自動で Activity Log に戻る
- **Auto-update**: 連続 fetch 時は PageViewer の内容を差し替え

### 設計根拠

TUI レイアウトの調査 ([The Terminal Renaissance](https://dev.to/hyperb1iss/the-terminal-renaissance-designing-beautiful-tuis-in-the-age-of-ai-24do)) から、aispy に最適なパターンは:

- **Header + Scrollable List** — Activity Log (リスト + stats)
- **Overlay/Popup** — PageViewer (必要時のみ表示)

Side-by-side split は情報密度が高いダッシュボード (btop 等) に向くが、aispy のように「時系列ログを見る → 詳細を drill down」というフローには single-column + overlay が自然。

Claude Code 自体も single-column レイアウト (メッセージ流れ + ツール出力 inline) を採用している。

## 自動画面遷移のフロー

```
AI: search("Lambda 1405")
  → Activity Log 表示 (検索結果 5 件)
  → ユーザーが結果を確認

AI: fetch(arxiv.org/...)
  → PageViewer auto-open (論文の中身)
  → ユーザーが AI が何を読んでいるか確認

AI: fetch(journals.aps.org/...)
  → PageViewer 更新 (次の論文に差し替え)

AI: search("sWeight technique")
  → PageViewer auto-close
  → Activity Log に新しい検索結果
  → ユーザーが AI の次の検索戦略を確認

AI: fetch(arxiv.org/...)
  → PageViewer auto-open (新しい論文)
```

ユーザーは何もしなくても AI の検索プロセスを追える。`q` でいつでも Activity Log に戻れる。
