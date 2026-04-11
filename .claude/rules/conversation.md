# 会話: 聞き終える前に計画しない

User との対話で、requirement を十分に引き出す前に plan や実装を始めない。

## 原則

- Senior engineer は code より先に plan を求める。
- Plan より先に **要件の確認** をする。
- User の発話が続く / 明らかに follow-up がある状況では plan を始めない。
- Ambiguous な要件で plan を作ると後で書き直しになる。曖昧さは放置しない。

## 非 trivial な request への対応手順

1. **ゴールを自分の言葉で 1-2 文に要約** して user に返す
   - 「X を Y するために Z を実装したい、で合っていますか」
2. **不明点を identify** する
   - 技術選択、scope 境界、優先順位、制約
3. 不明点が 2 つ以上あれば **`AskUserQuestion`** で聞く
4. User の確認 or 明示的な「進めて」を待つ
5. 確認後、plan（or `TaskCreate`）を作る

## 例外 — 直接実行してよい場合

- 1 step で終わる trivial な変更（typo 修正、1 行の import 追加等）
- User が既に明示的に「X をやって」と指示している
- Read / Grep / ls のような read-only 操作

## Plan の形式

Plan を立てるときは各 step に以下を含める:

```
Step 1: Brave API client の実装
  Spec:       §3.4, §4
  Files:      src/mcp/tools/search.ts (new)
  Interface:  export async function search(q: string): Promise<SearchResult[]>
  Done when:  search() が query を受けて { title, url, snippet }[] を返す
```

- やること（1 行）
- Spec のどの節に対応するか（section 番号）
- 触るファイル（相対 path、new / modify を明示）
- 完了の判定基準

## User 連投時の振る舞い

User が短時間に複数 message を送っている / 「それから」「あと」「で」で続けている間は planning を始めない。**Pause を待つ**。

一方、user が明示的に「ここまで」「以上」「start」「進めて」と言ったら即着手してよい。

## 必ず確認する項目

以下の曖昧さは必ず user に聞いてから進める:

- **Scope の境界** — どこまで実装するか（Phase 0 だけ？Phase 1 まで？）
- **非機能要件の優先順位** — 速度 vs 品質 vs 開発速度 vs API cost
- **外部 dependency の選択** — ライブラリ、API key、外部サービス
- **既存コードとの共存方針** — 置き換え vs 追加 vs 並行維持
- **Breaking change の可否** — interface 変更、dependency のメジャー変更

## 質問の形式

- 1 question 1 topic。複数を 1 文に混ぜない。
- 選択肢を提示できるときは `AskUserQuestion` で option を並べる。
- Open-ended question は最大 2 つまでに抑える。
- 「どうしますか？」より「A / B / C のうち推奨は A です、進めていいですか？」の方が user の負担が少ない。
