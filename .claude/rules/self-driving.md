# 自走 / 試行錯誤

Agent が自己検証しながら前進するための rule。推測ではなく証拠で進める。

## 完了宣言の前に必ず走らせる

```bash
npm run typecheck && npm run test && npm run lint
```

- 3 つ全て pass を確認する
- Report に output の要約を添える（test pass 数、lint error 0 等）
- 1 つでも fail したら「完了」とは言わない
- `verify` skill を使うと上記を自動化できる

Scaffold 前（package.json がまだない段階）はこの rule は skip してよいが、「scaffold 前なので verify 未実施」と明示的に report する。

## TUI 変更は実 render で確認

- 実際に terminal で `npm run dev` を立ち上げる
- 該当 UI を触って（キーバインド、scroll、入力）動作を確認する
- 動かしてないのに「動くはず」とは言わない
- TUI が起動できなかったら、その旨を明示的に report する（「動作確認できず: <理由>」と書く）
- 自動化できない場合は user に test を依頼してよい

## Iteration のサイズ

- 1 step = 1 verify サイクル
- 小さい diff（~50 行以下が目安）→ typecheck → test → 次
- まとめて 500 行書いてから verify、は禁止
- 失敗したら前の step に戻る。上に積まない
- 複数 file を同時に触る場合でも、論理的に 1 まとまりの変更に留める

## 詰まったときの writeup

Blocker に遭遇したら推測で突っ走らず、以下を書き出す:

```
Blocker: <何ができなかったか>
Tried:
  - <試したこと 1 と結果>
  - <試したこと 2 と結果>
Hypothesis: <原因の仮説があれば>
Need: <user または上位 agent に求めること>
```

推測で branch を選ばない。根拠がないときは user に聞く。

## Bug 修正の順序

1. 失敗する test を書く（再現）
2. Test が実際に fail することを確認
3. Fix を入れる
4. Test が pass することを確認
5. 既存 test も全 pass を確認

再現 test が書きづらい場合（環境依存、TUI の描画等）はその旨を report して手動確認で代替してよい。

## 禁止事項

以下は user の明示的な許可なく実行しない:

- `git commit --no-verify` / 全ての hook 回避
- `git push --force` / `git push -f`
- `git reset --hard` / `git checkout --` / `git clean -f`
- `git rebase -i` / `git rebase` で conflict 中に `--skip`
- `rm -rf` 系の破壊的操作
- Dependency の削除・downgrade
- CI/CD 設定の変更
- Secret が含まれる可能性のあるファイルの commit（`.env`, `credentials.json` 等）
- Pre-approved でない destructive な外部副作用（push, PR merge, message 送信等）

「失敗した CI を通すために hook を disable する」ような近道は禁止。**root cause を直す**。

## Spec ambiguity

Spec で答えが出ない問題に遭遇したら:

1. 解釈の候補を 2-3 個書き出す
2. それぞれの根拠と trade-off
3. 推奨案を 1 つ選ぶ
4. User に確認を取る（`AskUserQuestion` 推奨）

「こう解釈しました」と勝手に決めて実装しない。

## 失敗の扱い

- 失敗は恥ずかしいことではない。隠さずに report する。
- 同じ失敗を 2 回繰り返さない。1 回目でなぜ失敗したかを言語化する。
- 「試行錯誤の過程」を user に見せることは重要。黙って何度も直さない。
