# 既知の課題と改善候補

## Phase 1 で発見された課題

### P1: StatusBar が狭い幅で truncate される
- **症状**: ペイン幅が狭いと `connected` → `connecte`、`searches` → `searche` のように切れる
- **原因**: StatusBar のテキストが terminal 幅を超えた場合の省略処理がない
- **対応案**: テキストを短縮形に切り替え (`3 srch | 5 pg | 8.2k tok`) またはレスポンシブ表示

### P2: キーバインドヘルプが画面に表示されない
- **症状**: Tab/j/k/Enter/o/q のヒントがどこにも表示されない。spec §2.2 下部にはヒント記載あり
- **対応案**: StatusBar にフォーカス状態に応じたキーヒント表示 (`[Tab] switch [j/k] scroll [Enter] preview [o] open [q] back`)

### P3: `formatTime` 関数が SearchEntry / FetchEntry で重複
- **症状**: 同じ timestamp→HH:MM:SS 変換が 2 ファイルにコピー
- **対応案**: `src/ui/utils.ts` に抽出

### P4: FetchStartEvent 選択時に Enter で空の PageViewer が出る
- **症状**: "Fetching..." エントリ (FetchStartEvent) は content を持たない。選択して Enter → 何も表示されない
- **対応案**: FetchStartEvent 選択時は Enter を無視、または "Fetching in progress..." を表示

### P5: Node.js engine warning
- **症状**: ESLint 10 / `@eslint/js` が Node ≥ 20.19 を要求。ローカル Node は 20.18.3
- **影響**: 動作はする (npm install 成功、全 test pass) が engine warning が出る
- **対応案**: Node アップデートまたは ESLint 9.x にダウングレード

## Phase 2 候補 (spec §6 より)

- [ ] @mozilla/readability でメインコンテンツ抽出
- [ ] ANSI カラーによるシンタックスハイライト (見出し、リンク、コードブロック)
- [ ] ページ取得キャッシュ (同じ URL の再取得回避)
- [ ] `/` キーでログフィルタ
- [ ] `s` キーでセッション統計詳細表示
- [ ] search 結果の read/skip ラベル (retroactive: fetch 済み URL にマーク)
