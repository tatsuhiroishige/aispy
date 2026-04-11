# 開発原則 (multi-agent collaboration)

複数 agent が共同で aispy を開発する上での原則。CLAUDE.md の方針の詳細版。

## Spec-driven

- `concepts/aispy-spec.md` が source of truth。
- Spec にない要件は発明しない。抜け・曖昧さは user に確認する。
- コード変更は spec のどの節に対応するか明記する。spec 外の変更は「なぜそれが必要か」を事前に合意する。
- Spec と矛盾する提案をする場合は、先に spec の更新を user に提案する。

## タスク境界

- 各タスクは **触るファイル** と **変更する interface** を事前に宣言する。
- 複数 agent が同じファイルに同時に触らない。競合する場合は sequential に並べる。
- 並列 dispatch の条件（すべて満たす場合のみ）:
  - 3 つ以上の独立タスク
  - 共有 state / 共有ファイルなし
  - ファイル境界が明確
- いずれか欠けていれば sequential にする。
- 不明瞭な scope のタスクは並列に出さない。先に scope を確定させる。

## Evidence-based merge

- 変更ごとに runnable な verification を添える（詳細は `.claude/rules/self-driving.md`）。
- 「動くはず」「typecheck 通るはず」を根拠にしない。実際に走らせた output を引く。
- TUI 変更は必ず実 render で確認する。

## Subagent briefing template

Subagent に仕事を振るときは以下を含める:

1. **Goal** — 何を達成したいか、なぜ
2. **Constraints** — spec のどの節、触っていいファイル、触ってはいけないファイル
3. **What's already ruled out** — 既に検討して外した選択肢とその理由
4. **Deliverable format** — report の形式（diff / 説明 / ファイル list 等）
5. **Verification** — 完了の判定基準

Terse command 風の短い prompt は shallow な output を生む。上記を埋めた brief を書く。

## Plan 先行

- Trivial でないタスクはコードを書く前に plan を作る。
- Plan は step ごとに spec の節番号 or 触るファイルを明示する。
- Plan を書いたら user または上位 agent に確認してから着手する。
- 例外: 1 step で終わる trivial な変更（typo 修正、1 行の import 追加等）は直接やる。

## Context economy

- 1 agent の context は ~40% に抑える。大きな探索は subagent に委譲して report だけ持ち帰る。
- 同じ探索を main と subagent で重複させない。
- Subagent の raw output を main context にそのまま取り込まない。summary を受け取る。

## Handoff

- Agent 間の引き継ぎは会話記憶ではなく **書かれた artifact**（rule ファイル、plan、report）で行う。
- 「前回の会話で決めた」では通じない。必要なことは file に書く。
