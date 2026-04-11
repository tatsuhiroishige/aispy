# aispy

AI Search Process Visualizer — MCP server + Ink TUI that lets humans watch what AI is searching/reading on the web.

**Spec of record**: `concepts/aispy-spec.md` （作業前に必ず読む）

---

## 方針 (top-level)

このファイルは方針だけを書く。詳細は下記 rule ファイルを**該当する作業のときに**参照する。

- **Spec-driven**: spec が source of truth。spec にない要件は発明しない。
- **Plan 先行**: 非 trivial な作業はコードより plan を先に作り、user または上位 agent と合意してから着手する。
- **Evidence-based**: 完了宣言には runnable な verification を添える。「動くはず」を根拠にしない。
- **聞き終えてから計画**: user との対話で requirement を十分引き出してから plan を作る。

## Rules (参照先)

| 作業                                    | 参照                             |
|-----------------------------------------|----------------------------------|
| Multi-agent 連携 / タスク分割 / 引き継ぎ | `.claude/rules/dev-principles.md`     |
| TypeScript / Ink / MCP のコーディング   | `.claude/rules/coding-conventions.md` |
| 完了前 verification / 詰まったとき       | `.claude/rules/self-driving.md`       |
| User との会話 / 計画の timing           | `.claude/rules/conversation.md`       |

Rule ファイルは自動 load しない。作業に入る前に該当する file を Read する。

## Agents (`.claude/agents/`)

- **spec-planner** — phase や sub-goal を file 境界付きの task list に分解する
- **code-reviewer** — 変更が convention + spec に合っているか check、verification pipeline を走らせる

## Skills (`.claude/skills/`)

- **verify** — typecheck + test + lint を走らせて結果を report

## Status

Phase 0 以前（scaffold 前）。`src/` 未作成、`package.json` 未定義。
次の step: Phase 0 scaffold（MCP server skeleton + Brave API search/fetch + stderr logging）。
