# 2026 landscape と spec 更新提案

> **Status: Superseded (2026-04-14)** — §2 以降の "passive observer 維持" という結論は `tui-browser-pivot.md` により revise された。§1 の 2026 landscape 調査そのものは有効。本 note は履歴として残す。

AI browser agent 市場の 2026 年時点での動向と、それを踏まえた `aispy-spec.md` §1.3（aispy のポジション）と §8（市場ポジショニング）の update 提案。

調査日時点: 2026-04-14。

---

## 1. 2026 landscape summary

### 1.1 3 つの inflection

1. **Actor が多数派で確定**。OpenClaw (Steinberger / MIT)、hermes-agent (Nous Research)、MolmoWeb (Ai2 / pixel-only)、Vercel agent-browser、BrowserOS、Anthropic Managed Agents (2026-04-08 beta)、Gemini 3 auto browse、Opera Neon MCP Connector (2026-03-31) — 2026 年 Q1 の主要リリースはほぼ全て「AI が browser を動かす」側。aispy のような passive observer は競合増加ではなく **希少性が強化** された。

2. **MCP + terminal workflow が事実上の既定**。Chrome 146 WebMCP (2026-02)、Opera Neon MCP Connector、Playwright MCP の CLI / skills モード、Chrome DevTools MCP × Claude Code、Anthropic Agent Skills、Managed Agents。**aispy の「MCP server + 同一 terminal TUI」という形は 2025 年には尖って見えたが、2026 年には自然形**。

3. **Observability の terminal 回帰**。otel-tui (2026-04-08)、OpenClaw の TUI dashboard、Playwright MCP の YAML-to-disk CLI mode。Langfuse / LangSmith のような Web dashboard 型 observability の成熟の裏で、coding agent と同居する TUI 型 observability が独立サブジャンル化しつつある。aispy はその中で「AI の web research を見る」垂直を持つ。

### 1.2 軸別に見た 2026 の代表例

| Product | Launch (2025–2026) | Actor/Obs | Modality | MCP? | OSS? |
|---|---|---|---|---|---|
| OpenClaw | 2025-11 → 2026-02 10万★ | Actor | text + pixel | Partial (DevTools MCP) | ✓ |
| hermes-agent | 2026-02 | Actor | text-first + pixel fallback | ✗ | ✓ |
| MolmoWeb (Ai2) | 2026-03-24 / 4-10 | Actor | **pixel only** | ✗ | ✓ (Apache-2.0) |
| Vercel agent-browser | 2026-01 (active) | Actor | text (a11y snapshot) | ✗ | ✓ |
| Playwright MCP CLI | 2026 update | Actor | a11y tree (114k→27k tok) | ✓ | ✓ |
| Opera Neon MCP Connector | 2026-03-31 | Actor host | — | ✓ | ✗ |
| Claude Managed Agents | 2026-04-08 beta | Actor | — | ✓ | ✗ |
| otel-tui | 2026-04-08 | Observer | OTel | ✗ | ✓ |
| **aispy** | — | **Observer** | **Rendered text** | **✓** | **✓** |

### 1.3 Direct competitor の有無

「AI が今読んでいる web page の rendered text を人間が TUI で並読する」 positioning を取る product は 2026-04 時点で確認できず。近接は Claude Code hook dashboards（disler、claude-view、ccboard）だが、それらは (a) web 特化でない、(b) Web GUI で terminal 並走でない、(c) rendered page text ではなく tool call JSON を見せる — という 3 点で別物。

---

## 2. §1.3（aispy のポジション）更新提案

### Before（現状）

> aispyは「AIがウェブを操作するためのブラウザ」ではない。**「AIがウェブから何を読んでいるか、人間が覗き見するためのモニター」**である。
>
> AIにとってはJSON形式のMCPツール。人間にとってはTUI画面。見ているデータは同じ。

### After（提案）

> aispyは「AIがウェブを操作するためのブラウザ」ではない。**「AIがウェブから何を読んでいるか、人間が覗き見するためのモニター」**である。Actor（browser-use、OpenClaw、hermes-agent、Claude for Chrome、ChatGPT Agent 等）が AI に browser を渡すツールだとすれば、aispy は AI に text tool を渡し、その活動を人間が TUI で読む **passive observer**。
>
> AIにとってはJSON形式のMCPツール。人間にとってはTUI画面。見ているデータは同じ。
>
> 2025–2026 年、AI browser agent 市場の新規参入はほぼ全てが actor 側に集中している。aispy の passive observer は競合が薄く、Claude Code / Cursor 等で AI の research process を debug したい開発者にとって直接的な代替品が事実上ない。

### 狙い

- 「observer vs actor」という軸を明示的に言語化する。現状の "操作するブラウザではない" という否定形だけでは、2026 の読者に "じゃあ何なんだ" が伝わりにくい。
- passive observer をカウンターポジションとして肯定形で打ち出す。
- 2026 の文脈（actor 一辺倒）を spec 自体に埋めておくことで、今後の設計判断の拠り所になる。

---

## 3. §8（市場ポジショニング）更新提案

### §8.1 既存ツールとの差別化表を拡張

現状の table は 2024 年末の情報。2025–2026 の actor 新興勢・observability 隣接・MCP platform 進化を反映する。

```markdown
| ツール                 | 分類            | アプローチ                        | aispyとの違い                          |
|------------------------|-----------------|-----------------------------------|----------------------------------------|
| browser-use            | OSS actor       | Playwright + DOM 蒸留             | AI 操作用。観察は副次的                |
| Stagehand v3           | OSS actor       | CDP + a11y tree                   | 開発者向け automation SDK              |
| Playwright MCP         | OSS actor       | a11y tree を MCP で expose        | AI が browser を動かす基盤             |
| Skyvern / MolmoWeb     | Vision actor    | Screenshot + VLM                  | Pixel-based、人間可読な text 層なし    |
| OpenClaw / hermes-agent| Personal agent  | Messaging UI + multi-tool         | actor。ブラウザはその 1 tool           |
| Claude for Chrome      | Actor extension | DOM + screenshot                  | 自 browser 上で AI が動く              |
| ChatGPT Agent / Atlas  | Consumer actor  | VM / DOM + memories               | ChatGPT 統合の actor                   |
| Comet / Dia / Neon     | AI browser      | Standalone browser                | Consumer 向け actor                    |
| Brave Leo              | AI browser      | TEE + multi-tab                   | Privacy 路線の consumer actor          |
| Langfuse / LangSmith   | Observability   | LLM trace (Web dashboard)         | 汎用 trace、web 特化でない             |
| claude-view / ccboard  | Claude Code obs | Hook → Web dashboard              | 別窓 Web、rendered page text 非表示    |
| otel-tui               | Terminal obs    | OTel → TUI                        | 汎用 OTel、web 特化でない              |
| Browsh / Chawan        | Human browser   | TUI browser                       | 人間のブラウジング、AI 連携なし        |
| **aispy**              | **MCP observer**| **MCP + TUI + rendered text**     | **AI の web 読み取りを人間が観察**     |
```

### §8 に新節「8.4 MCP platform 化への追随」を追加

```markdown
### 8.4 MCP platform 化と aispy

2026 年時点で MCP は agent connector の事実上の標準（Chrome 146 WebMCP、Opera Neon MCP Connector、
Anthropic Managed Agents、Playwright MCP CLI mode）。aispy が MCP server として設計されて
いることは、この流れに自然に乗る。

Actor MCP（Playwright MCP、Chrome DevTools MCP、Opera Neon Connector 等）と aispy は layer が
異なる。Actor MCP は AI に「操作する機能」を渡す。aispy は AI に「検索・取得する機能」を渡し、
人間に「何を検索・取得したか」を見せる。共存可能で、詳細は `concepts/actor-mcp-coexistence.md`
を参照。
```

### §8.2 ターゲットユーザー更新

2026 の actor 普及を受け、以下を追加:

```markdown
4. OpenClaw / hermes-agent / Claude Managed Agents 等の personal agent の user で、
   自分の agent が何を読んでいるか監視したい人
5. Claude Code + Chrome DevTools MCP / Playwright MCP を併用している開発者で、
   web research の text 面を TUI で追いたい人
```

---

## 4. 更新判断

- §1.3 と §8.1 は **更新推奨**（market 説明は 1 年で陳腐化するので放置すると spec の信頼性が落ちる）。
- §8.4 の新節は `actor-mcp-coexistence.md` を書いた後にまとめて入れる。
- §8.2 の ターゲットユーザー追加は §8.1 と同時に行う。

## 5. 更新しない判断

- §3（技術 architecture）、§4（技術スタック）、§6（開発フェーズ）は 2026 landscape に影響されない。触らない。
- §9.1 WebMCP メモは 2025 執筆時から正しく機能している。Chrome 146 preview 出荷後の具体情報は追記候補だが、補完関係の結論自体は変わらない。

---

## Sources

- [OpenClaw — Wikipedia](https://en.wikipedia.org/wiki/OpenClaw)
- [hermes-agent — Nous Research](https://hermes-agent.nousresearch.com/)
- [MolmoWeb — Ai2](https://allenai.org/blog/molmoweb)
- [Vercel agent-browser](https://github.com/vercel-labs/agent-browser)
- [Opera Neon MCP Connector](https://press.opera.com/2026/03/31/opera-neon-adds-mcp-connector/)
- [Claude Managed Agents — SiliconANGLE](https://siliconangle.com/2026/04/08/anthropic-launches-claude-managed-agents-speed-ai-agent-development/)
- [Playwright MCP 2026 updates — Bug0](https://bug0.com/blog/playwright-mcp-changes-ai-testing-2026)
- [WebMCP in Chrome 146 — Chrome Developers](https://developer.chrome.com/blog/webmcp-epp)
- [otel-tui — LinuxLinks](https://www.linuxlinks.com/otel-tui-terminal-based-observability-viewer/)
