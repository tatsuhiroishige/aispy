# TUI Browser Pivot

> **Status: Active (2026-04-14)** — aispy の primary identity を「MCP passive observer」から「AI 時代の TUI browser」に pivot する判断を記録する。`2026-landscape-and-positioning.md` と `actor-mcp-coexistence.md` の "passive observer 維持" という結論は本 note により revise された。

---

## 1. 判断

### 1.1 新しい 1 行 positioning

**The TUI browser built for the AI era** — Chawan 級の CSS layout rendering を TypeScript + Ink + MCP で再構成し、人間と AI が同じ viewer でウェブを読む terminal browser。

### 1.2 Identity の変化

| | Before (〜2026-04) | After (pivot 後) |
|---|---|---|
| Primary identity | AI の web 行動を観察する MCP observer | AI 時代の TUI browser |
| 主役 | Activity Log（AI の行動ログ） | Page Viewer（ページそのもの） |
| 人間の操作 | 観察 + `o` で外部 browser に逃がす | **TUI 内で直接 browse**（URL 入力 / link / form） |
| AI の操作 | MCP search / fetch 呼び出し | 同じ browser の MCP tool として search / fetch |
| 共有される物 | AI が呼んだ tool call のログ | **同じ rendered page view** |
| 突き抜ける軸 | niche positioning（observer 空白） | **TUI rendering の技術深度 + AI 連携の不可分性** |

### 1.3 Pivot 根拠

- **2026 landscape の再解釈**: `2026-landscape-and-positioning.md` の調査で「passive observer は競合薄い」と結論したが、それは **niche として空白** というだけで、技術野心として "突き抜け" 感が弱い。Actor 一辺倒の市場に対してカウンターを取る positioning としては正しいが、product の魅力としては地味。
- **Chawan 型の TUI browser を TS + AI 連携で作る領域は完全な空白**。Chawan (Nim) は human-primary、Browsh は Firefox 寄生、Ink 生態系（Claude Code / Cursor / Gemini CLI / Amp / OpenCode）に first-class で住む TUI browser は誰も作っていない。
- **Phase 3 は元々 spec にある**。現状の Phase 3 計画（CSS パーサー + layout engine + 文字グリッドへの mapping）は、やりきれば primary 価値になりうる内容。これを「将来の改善」ではなく **core value proposition** に昇格させる。
- **AI 連携を側面機能でなく不可分にする**: Chawan を単に TS で書き直すだけでは存在意義が弱い。AI agent が MCP で同じ browser を使い、人間とビューを共有することで「AI 時代の」が意味を持つ。

---

## 2. 設計の骨格

### 2.1 人間と AI が同じ browser を共有する

```
┌──────────────────── aispy TUI ────────────────────┐
│ [URL bar]  https://arxiv.org/abs/2501.xxxxx       │
│ [h] back  [l] fwd  [Enter] go  [t] tabs  ...      │
├────────────────────────────────────────────────────┤
│                                                    │
│  Page Viewer (CSS layout rendering)                │
│  ─ Λ(1405) photoproduction with CLAS12 ─          │
│  Authors: A. Smith, B. Jones...                    │
│  Abstract: We report the first measurement...      │
│  [Figure 1] ... [link] ... [section]              │
│                                                    │
├─────────────┬──────────────────────────────────────┤
│ Activity    │ Tabs: [1] arxiv  [2] inspire  [*3]  │
│ (AI log)    │                                      │
│ ● AI: search                                       │
│ ● AI: fetch (this tab)                             │
│ ● You: click "Figure 1"                            │
└─────────────┴──────────────────────────────────────┘
```

同じプロセス、同じ TUI、同じ rendering。違うのは誰が次のアクションを発行するか（人間のキー or AI の MCP call）だけ。

### 2.2 Component の再編

| Component | Role の変化 |
|---|---|
| **Page Viewer** | Side pane → **primary component**。CSS layout engine + navigation state を持つ |
| **Activity Log** | Primary → secondary pane。AI 活動の時系列 feed として残るが、畳める |
| **URL bar** | 新設。人間が URL 入力・navigation |
| **Tab manager** | 新設。複数ページ並行保持、AI fetch と人間 navigation が tab を共有 |
| **Browser state** | 新設。history / session / cookie / local storage (最小限) |
| **MCP server** | 残す。ただし「AI が fetch したら current tab になる」のように browser と統合 |

### 2.3 Chawan との関係

- **Fork しない**。Chawan は Nim 単一バイナリ、Ink 生態系に入れない。
- **Wrapper にもしない**。外部プロセス呼び出しは Claude Code との統合が疎になる。
- **Design reference として TS で独立実装**。参考にする要素:
  - CSS layout engine の構成（flow / table / flexbox）
  - HTML5 parser の treat （Chame 相当は `parse5` で代替可）
  - 文字グリッドへの box → cell mapping
  - Sixel / Kitty inline image protocol（将来）
- aispy 独自の付加価値:
  - **AI-native from day 1**: MCP server を標準搭載、AI が同じ browser を共有
  - **Ink 生態系**: Claude Code / Cursor / Gemini CLI の隣で動く、TypeScript で extensible
  - **Readability 寄りの reader mode**: `@mozilla/readability` で AI にも人間にも読みやすい抽出を第一級機能として提供

### 2.4 JS 実行は当面しない

- Chawan は QuickJS を組み込むが、動的 DOM を TUI に反映するのはコストが重い。
- aispy の初期 scope は **static HTML + CSS + form (GET/POST)** までに限定する。
- 対象ドメイン: docs サイト、arxiv、news、blog、GitHub（static pages）、Wikipedia など AI agent が頻繁にアクセスする層。
- JS 必須の SPA は `o` キーで外部 browser へ逃がす（spec §7.4 の安全弁はそのまま維持）。
- JS は Phase 7+ の将来項目。

---

## 3. Scope と非 scope

### 3.1 Scope（pivot 後に作るもの）

- CSS layout engine（flow / block / inline / flexbox、table は後回し）
- HTML5 parser (`parse5`)
- URL bar + address navigation
- Link click で navigation
- Back / forward / history
- Tab 管理（複数ページ並行）
- Form input（GET/POST、simple inputs）
- Session（cookie 最低限）
- Readability-based reader mode（既存）
- MCP search / fetch（既存、browser 統合強化）
- Keybindings 拡充（URL 入力、tab 切替、history）

### 3.2 非 Scope（少なくとも当面やらない）

- JavaScript 実行
- WebSocket / SSE
- WebAssembly
- Service worker / offline
- Extensions API
- 動画 / 音声
- Sixel / Kitty inline image（Phase 後期で検討）
- Password manager / autofill
- User authentication flow（OAuth 等は外部 browser に逃がす）

### 3.3 原則

- **Reader の質を最大化**。書き込みはある程度妥協する。
- **AI が読めるものは人間も読める**。逆も然り。同じ text 抽出パイプライン。
- **複雑なサイトは `o` で外部 browser に逃がす安全弁**を維持。

---

## 4. Phase 再構成案

現状 spec の Phase:

- Phase 0 ✓ minimal MCP
- Phase 1 ✓ basic Ink TUI
- Phase 2 ✓ content quality (readability, ANSI colors, cache, filter, stats, read/skip labels)
- Phase 3 **進行中** CSS layout rendering
- Phase 4 production (npm, multi-backend)

Pivot 後の Phase 案:

| Phase | 内容 | 位置づけ |
|---|---|---|
| 0–2 | 既存 | 完了、変更なし |
| **3** | CSS layout rendering — flow / block / inline + flexbox | **現在進行中、pivot の core**。完了で Page Viewer が reader として実用レベル |
| **4 (new)** | Interactive browser mode — URL bar, navigation, back/forward, link click, tab | human が直接 browse できるようになる。identity 転換点 |
| **5 (new)** | Polish — form input, history, bookmark, session (cookie), keybindings 整備 | "TUI browser" として名乗れる完成度 |
| **6** | Production / ecosystem — npm 公開, multi search backend, 複数 AI client 対応 | （旧 Phase 4 の内容） |
| 7+ | 将来 — Sixel/Kitty, JS, etc. | 野心項目 |

Phase 3 の完了が pivot の **第一関門**。ここで CSS rendering が Chawan に見劣りしない水準に達してから、Phase 4 の interactive mode に進む。

---

## 5. 差別化の更新

| 対象 | 差別化点 |
|---|---|
| **Chawan** (Nim, public domain) | TS + Ink 生態系に住める / AI-native MCP / Claude Code と同一 terminal |
| **Browsh** (Firefox 寄生) | 軽量、外部依存なし、AI 連携 |
| **Actor agents** (browser-use, OpenClaw, hermes-agent, Claude for Chrome) | 人間も読める UI が primary / MCP text layer 標準 |
| **Consumer AI browser** (Comet, Atlas, Dia, Neon, Edge Copilot) | Terminal-native, text-based, 軽量, scriptable |
| **Observability tools** (Langfuse, claude-view, otel-tui) | AI 観察は副次機能、primary は browser そのもの |
| **Playwright MCP / Chrome DevTools MCP** | Actor layer でなく reader layer、人間が直接操作可能 |

核となる主張: **"Chawan の technical depth を TS で書き直し、AI-native integration と Ink 生態系への一体化を武器にする"**。

---

## 6. リスクと trade-off

### 6.1 Scope 膨張

CSS layout engine は Chawan が 1 人・数年の仕事。フルに追うのは現実的でない。
**対策**: (a) flexbox と block flow を最優先、table は後回し、positioning は static のみ、(b) yoga-layout（Meta 製、flexbox 独立実装）を使い自前実装を減らす、(c) 100% Chawan 相当を目指さず「reader として十分」を Phase 3 の達成基準にする。

### 6.2 Identity 転換のコスト

これまでの "passive observer" メッセージと矛盾する。Supersede した concept note は残すが、README / spec / marketing を新方向に揃える必要がある。**対策**: 次ステップで spec 本体 §1.3 / §2 / §6 / §8 を書き換える。

### 6.3 JS なしの制約

2026 の web はほぼ SPA。JS 実行なしだと読めないサイトが多い。**対策**: (a) `o` キーの安全弁を維持、(b) reader mode で extracted content だけ出す、(c) 対象 persona（docs / arxiv / blog を読む開発者）にとって JS 不要なサイトがまだ多いことを前提に置く。

### 6.4 Chawan との対立

Chawan ユーザーから「なぜ Nim を TS に書き直すのか」という疑問は出る。**対策**: aispy は Chawan 置換ではなく「AI 時代の TUI browser」という別 product。Chawan 自体の価値は否定しない（design reference として credit する）。

### 6.5 AI agent 側が求めるか

Claude Code / Cursor のような coding agent が「human と同じ browser を共有」する UX を求めるかは未検証。**対策**: MVP でユーザー（開発者）に試してもらい、AI 側 UX は後から整える。まず human-readable な TUI browser として価値を出す。

---

## 7. 次ステップ

### 7.1 この concept note 確定後

1. **spec 本体の書き換え**（別ステップ）
   - §1.3 positioning 更新（observer → TUI browser）
   - §2.1–2.3 画面構成に URL bar / tab / navigation keys 追加
   - §3 architecture に browser state（history / session）追加
   - §6 Phase 再構成（本 note §4 を反映）
   - §7.1–7.4 設計原則の微修正
   - §8 市場 positioning 全面更新

2. **Phase 3 の完成定義を確定**
   - 現状 Phase 3 の step（parser → resolver → layout → render）は既に走っている
   - "reader として実用" の具体的基準を書く（どの 10 サイトで問題なく読めたら完了か）

3. **Phase 4 設計の先行検討**
   - URL bar + tab 管理の Ink 実装パターン
   - Browser state の store 設計（現 `core/store.ts` の拡張 or 分離）
   - Key binding 拡充案（vimium 風 or Chawan 風）

### 7.2 書かない / やらない

- Spec の書き換えは本 note 確定後に別タスク。今はやらない。
- Phase 4 の実装着手は Phase 3 完了後。先走らない。
- Marketing / README 更新は spec 書き換え後。先走らない。

---

## Sources

- `concepts/2026-landscape-and-positioning.md` (superseded、履歴)
- `concepts/actor-mcp-coexistence.md` (superseded、履歴)
- `concepts/aispy-spec.md` (特に §1.3, §4.1, §6, §8)
- [Chawan TUI web browser](https://chawan.net/)
- [parse5 — HTML parser for Node.js](https://github.com/inikulin/parse5)
- [yoga-layout — Facebook flexbox impl](https://github.com/facebook/yoga)
