# Actor MCP と aispy observer の共存

> **Status: Superseded (2026-04-14)** — 本 note は aispy が "passive observer" のままである前提で共存設計を書いている。方向性は `tui-browser-pivot.md` で「AI 時代の TUI browser」に pivot したため、actor MCP との関係性は再設計が必要。履歴として残す。

2026 年、MCP は agent connector の事実上の標準になりつつある（Chrome 146 WebMCP、Opera Neon MCP Connector、Playwright MCP の CLI / skills モード、Anthropic Managed Agents）。このエコシステムで aispy が passive observer として果たす役割と、actor MCP との共存設計を整理する。

関連: `2026-landscape-and-positioning.md`、`aispy-spec.md` §1.3, §3, §8。

---

## 1. 問題設定

開発者の典型的な環境:

```
Claude Code
  ├── aispy (MCP: search, fetch)           ← aispy がホストする tool
  ├── Playwright MCP / Chrome DevTools MCP  ← Actor MCP
  ├── filesystem MCP
  └── ...
```

AI は状況に応じて tool を選ぶ。検索・取得なら aispy、browser 操作なら Playwright MCP、ファイル操作なら filesystem MCP。**aispy は自分の tool を経由した call しか観察できない**。Playwright MCP が操作した結果は aispy の TUI には出ない。

これは spec §3.2 「MCP 提供の web fetch ツールがある場合 Claude Code はそちらを優先する」という前提に依存している。検索・取得の layer では現状の設計で十分だが、**AI が browser を能動的に操作する文脈**（form 入力、click、JS 実行、認証を伴う navigation 等）は aispy の観察対象外。

---

## 2. 設計の原則

**aispy は layer を越えない**。

aispy は「AI の web reading を人間に見せる」tool であり、「AI が browser を操作するのを人間に見せる」tool ではない。後者は本質的に pixel / DOM state の表示を要求し、text-first, token 軽量, MCP 透過という aispy のコア設計と衝突する。

したがって **actor MCP と aispy は共存するが統合はしない**。役割を分担する。

| 役割                                | 担当                        |
|-------------------------------------|----------------------------|
| AI が browser を操作する            | Playwright MCP / Chrome DevTools MCP / Opera Neon MCP Connector |
| Actor の操作を human に見せる       | Actor MCP 自身の TUI / dashboard（例: OpenClaw の TUI）、または Claude Code hook observability |
| AI が web を検索・取得する          | **aispy**                  |
| Search / fetch の rendered text を human に見せる | **aispy**                  |
| AI の全 tool call を俯瞰する        | Langfuse / claude-view / ccboard / otel-tui |

aispy は **検索・取得の垂直**に特化し、actor の動きや全 tool call の俯瞰は別 tool に委ねる。

---

## 3. 具体的な共存シナリオ

### 3.1 Research + Automation の分業

開発者が「arxiv を検索して論文の一覧を得て、その中から気になった 1 本を browser で開いて scroll しながら精読する」ケース:

```
Claude Code
  └── aispy.search("CLAS12 Lambda 1405")     → aispy TUI Activity Log
  └── aispy.fetch(arxiv.org/abs/2501.xxxxx)  → aispy TUI Page Viewer (rendered text)
  └── playwright.navigate(arxiv pdf url)      → Playwright MCP が browser 起動
  └── playwright.screenshot()                  → （aispy には出ない）
```

aispy は **前段の "何を検索して何を読んだか" を担い**、後段の実 browser 操作は Playwright MCP に任せる。両者は同じ Claude Code session 内で並存する。

### 3.2 Opera Neon MCP Connector 経由で他 agent が browser を使う場合

Opera Neon は 2026-03-31 に MCP endpoint を搭載し、外部 agent が Neon の browser session を操作できるようになった。この場合:

```
OpenClaw / Claude / ChatGPT
  ├── neon.click(...) ─────────────→ Opera Neon が操作
  └── aispy.fetch(...)  ───────────→ aispy TUI に rendered text
```

AI は「軽い取得」を aispy に、「重い操作」を Neon に振り分ける。人間は aispy で text を読みつつ、Neon 側で browser の視覚状態を見る。**2 つの pane を並べる運用**。

### 3.3 Personal agent (OpenClaw / hermes-agent) から aispy を呼ぶ

OpenClaw や hermes-agent は messaging UI で自律タスクを走らせる。browser 操作は内蔵。しかし **検索・取得 layer** で aispy を MCP server として接続できれば、「うちの personal agent が今何を読んでるか terminal で見たい」という需要を満たせる。

```
OpenClaw / hermes-agent
  └── MCP: aispy.search / aispy.fetch        → aispy TUI
  └── 内蔵 browser automation                → OpenClaw の TUI / agent log
```

ターゲットユーザーの §8.2 更新案（`2026-landscape-and-positioning.md` §3）はこの想定。

---

## 4. 実装的な論点

### 4.1 AI が aispy.fetch と actor MCP の navigation をどう使い分けるか

Claude Code は tool description を見て選ぶ。aispy の fetch は「text を抽出して返す」、Playwright MCP の navigate は「browser state を更新する」。**description の分業**で誤選択を抑える。

Spec §3.3 の fetch の description 現状:

> "Fetch a web page and return its text content"

これは明瞭で、actor MCP と競合しない。変更不要。

### 4.2 aispy が actor の動きを "peek" できないか

可能性として検討したが、**しない**:

- **Option A**: Claude Code の hook (PreToolUse / PostToolUse) を読んで全 tool call を TUI に出す → claude-view / ccboard と同じ領域に入る。aispy の「rendered page text を見せる」差別化が薄まる。
- **Option B**: aispy を "wrapper MCP" にして actor MCP の call を仲介 → MCP protocol 上は可能だが、actor の生の browser state（screenshot, DOM）を text に変換する責務が aispy に乗り、scope が肥大化する。
- **Option C**: OTel 経由で span を受け取る → otel-tui の領域。

どれも「aispy が aispy でなくなる」方向。**やらない**。

### 4.3 逆: actor MCP の user が aispy を並列に入れたくなるか

これは **Yes**。Playwright MCP で automation を書いている開発者は、AI が参考情報を取りに行った時の rendered text を見たいことがある（特に認証不要な arxiv / docs サイト等）。aispy を同じ Claude Code session に足すコストは低い（`claude mcp add` 1 回）。この組み合わせ使用は推奨 UX として README に書く価値がある。

---

## 5. Documentation への反映

`aispy-spec.md` §8 に新節として以下を追加するのが妥当（`2026-landscape-and-positioning.md` §3 で提案した §8.4）:

```markdown
### 8.4 MCP platform 化と aispy

Actor MCP（Playwright MCP, Chrome DevTools MCP, Opera Neon MCP Connector 等）と
aispy は layer が異なる。Actor MCP は AI に「操作する機能」を渡し、aispy は AI に
「検索・取得する機能」を渡す。共存可能で、aispy は actor の動きを代替・観察しない。

典型的な運用は `concepts/actor-mcp-coexistence.md` を参照。
```

README レベルでは「Playwright MCP と併用して research + automation を分業する」「Opera Neon MCP と並べて browser 状態と rendered text を両方見る」ような use case 例を 1–2 個示せばよい。

---

## 6. 原則の再確認

- aispy は **search / fetch の text layer** に絞る。Actor の layer には踏み込まない。
- Actor MCP と aispy は **同じ Claude Code session に共存**できるが、観察 scope は分離する。
- aispy が「全 tool 観察 dashboard」になることは **設計として避ける**。それをやると claude-view / ccboard / Langfuse の領域に入り、独自性を失う。

---

## Sources

- [Opera Neon MCP Connector — 9to5Mac](https://9to5mac.com/2026/03/31/opera-neon-doubles-down-on-agentic-browsing-with-mcp-support/)
- [Playwright MCP CLI mode — Bug0](https://bug0.com/blog/playwright-mcp-changes-ai-testing-2026)
- [Chrome DevTools MCP × Claude Code](https://code.claude.com/docs/en/chrome)
- [Claude Managed Agents — SiliconANGLE](https://siliconangle.com/2026/04/08/anthropic-launches-claude-managed-agents-speed-ai-agent-development/)
- [WebMCP in Chrome 146](https://developer.chrome.com/blog/webmcp-epp)
