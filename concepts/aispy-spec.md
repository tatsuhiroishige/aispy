# aispy — The TUI Browser for the AI Era

## TL;DR

aispyは、AI時代のTUIブラウザ。人間はターミナルでURLを入力してウェブを読み、AI（Claude Code等）はMCPツール経由で同じブラウザを操作する。両者は同じレンダリング結果を共有する。Chawan級のCSSレイアウトエンジンをTypeScript + Ink + MCPで再構成し、Claude Code / Cursor / Gemini CLIの生態系にfirst-classで住まわせた。

---

## 1. コンセプト

### 1.1 解決する問題

2つの問題を同時に解く。

**人間側の問題**: ターミナルで作業している開発者は、ウェブを読むたびにブラウザに切り替える必要がある。Chawanのような TUI ブラウザは存在するが、独自エコシステム (Nim) で TS/Ink ベースの AI 生態系 (Claude Code / Cursor / Gemini CLI) と相性が悪い。

**AI側の問題**: AIがウェブを読むとき、「AIが今何を見ているか」を人間が覗く手段がない。Claude Codeが`Searching...`と表示しているあいだ、結果だけがポンと返ってくる。CLI操作はtmuxで見えるのに、ウェブだけがブラックボックスのまま残っている。

両者は同じ根にある。**「ターミナルでレンダリングされた、人間もAIも読めるウェブ」**が存在しないこと。aispyはそれを作る。

### 1.2 根本的な洞察

> 人間とAIがどちらも理解できるinterfaceで、かつテキストベースであるためデータ量が軽量。

スクリーンショットベースのブラウザ操作（Claude in Chrome等）は、画像のエンコード→VLM推論→次のアクション、の1サイクルが重い。操作ステップが増えるほどスクショの回数が増えるだけ。テキストベースなら同じ情報をトークン1/10以下で表現でき、人間にも読める。

同じrenderingを共有できることが、"AI時代のブラウザ"のコア。AIがaispyで取得したページを、人間が同じTUIで見る。人間がaispyで開いたページを、AIが同じrendererで読む。pixel / DOM / screenshotを経由しない、textが単一の真実。

### 1.3 aispyのポジション

aispyは**「AI時代のTUIブラウザ」**である。2つの顔を持つ:

1. **人間にとって**: ターミナル内で動く軽量ブラウザ。URLを入力してページを開き、リンクを辿り、フォームに書き込む。Chawan級のCSSレイアウトでページが実用的に読める。
2. **AIにとって**: MCPサーバー。`search` / `fetch` などのツールを提供し、AIが呼び出したら同じTUI内の viewer にページが表示される。

両者は**同じプロセス、同じTUI、同じrenderer**を共有する。違いは誰が次のアクションを発行するかだけ（人間のキー操作か、AIのMCP呼び出しか）。

2025–2026年のAI browser agent市場はほぼ全てが **actor** 側（AI が browser を操作するツール：browser-use、OpenClaw、hermes-agent、Claude for Chrome、ChatGPT Agent 等）。aispyは **reader** 側のカウンターポジション。AIが操作するよりも人間もAIも「読む」ことに最適化された browser。

差別化の核:

- **Chawanの technical depth を TypeScript で再構成**：Chawan は Nim 単一バイナリで Ink 生態系に入れない。aispyは CSS layout engine (`src/core/cssResolver.ts`, `flexLayout.ts`, `htmlRenderer.ts`) を TS で独立実装。
- **AI-native from day 1**：MCPサーバーを標準搭載。Claude Code / Cursor / Gemini CLI から`claude mcp add`1回で接続。
- **同一 terminal TUI**：Web dashboard型のagent observability (Langfuse / LangSmith) とは異なり、coding agentと同じターミナルでInk TUIとして並走。

詳細な差別化軸は §8。pivot に至る landscape 分析は `concepts/2026-landscape-and-positioning.md` と `concepts/tui-browser-pivot.md` を参照。

---

## 2. プロダクト設計

### 2.1 起動と接続

aispyは2つのモードで動作する：

**TUIモード**（人間が手動起動）:
```bash
$ aispy
```
TUI画面が表示され、Unix domain socket（`/tmp/aispy-<user>.sock`）でMCPプロセスからのイベントをlistenする。

**MCPモード**（Claude Codeが子プロセスとして起動）:
```bash
$ aispy --mcp
```
stdio MCP serverとして動作する。TUIプロセスのsocketに接続し、search/fetchのイベントをforwardする。socketが存在しない場合はstderrにログを出力して動作を継続する（TUIなしでも使用可能）。

Claude Codeの設定（`~/.claude.json`）に追加：

```json
{
  "mcpServers": {
    "aispy": {
      "command": "aispy",
      "args": ["--mcp"],
      "env": {
        "BRAVE_API_KEY": "your-brave-api-key"
      }
    }
  }
}
```

典型的な使い方：tmuxで2ペインを開き、片方で`aispy`（TUI）、もう片方でClaude Codeを起動する。

### 2.2 画面構成

TUI画面は以下のエリアで構成される（Phase 4 完了時の target state）:

```
╔═══════════════════════════════════════════════════════════╗
║ aispy │ ● connected │ https://arxiv.org/abs/2501.xxxxx   ║  ← URL bar
╠═══════════════════════════════════════════════════════════╣
║ [1] arxiv  [*2] aps.org  [3] inspire  [+]                 ║  ← Tab bar
╠═══════════════════════════════════════════════════════════╣
║                                                            ║
║  Page Viewer (primary)                                     ║
║                                                            ║
║  Chawan級のCSSレイアウトでレンダリングされたページ。        ║
║  人間が scroll / link click / form 入力で navigate。       ║
║  AIが fetch したページもこの viewer に表示される。          ║
║                                                            ║
╠═══════════════════════════════════════════════════════════╣
║ Activity Log (折り畳み可能)                                 ║
║ 14:23:01 Search "CLAS12 Lambda 1405"                       ║
║ 14:23:08 Fetch arxiv.org/2501.xxxxx                        ║
╠═══════════════════════════════════════════════════════════╣
║ 3 searches │ 5 pages │ 8,241 tokens │ 14.2s                ║  ← Status bar
╚═══════════════════════════════════════════════════════════╝
```

現状 (Phase 3) は URL bar / Tab bar が未実装で、Activity Log が primary、Page Viewer は fetch 時に切り替え表示される簡易形。Phase 4 で URL bar / Tab が、Phase 5 で form / history / session が追加される。Phase 進捗は §6。

#### URL bar (Phase 4+)

現在ページの URL を表示。`g` で URL 入力モードに入り、任意の URL へ navigate。back/forward/reload の状態を示す。

#### Tab bar (Phase 4+)

複数ページを並行保持。`[*2]` のように active tab を示す。人間が新規に開いた tab と AI が `fetch` で取得した tab が同列に並ぶ。

#### Page Viewer (primary)

CSS layout engine でレンダリングされたページ。

```
┌─ arxiv.org/abs/2501.xxxxx ────────────────────┐
│                                                │
│ Electroproduction of Λ(1405)                   │
│ with CLAS12 at Jefferson Lab                   │
│                                                │
│ A. Smith, B. Jones, C. Williams                │
│ ... and the CLAS Collaboration                 │
│                                                │
│ Phys. Rev. C 109, 015201 (2025)                │
│ ──────────────────────────────────────         │
│                                                │
│ Abstract:                                      │
│ We report the first measurement of             │
│ Λ(1405) electroproduction using the            │
│ CLAS12 detector at Jefferson Lab...            │
│                                                │
│ [→ Read full PDF]  [→ Related papers]          │
└────────────────────────────────────────────────┘
```

Readability で抽出した reader mode と、CSS フルレイアウトの two-tier rendering。Phase 3 で後者を flow / block / inline / flexbox 対応まで実装済み。

#### Activity Log (折り畳み可能)

AIの search / fetch 履歴 + 人間の navigation 履歴が時系列で流れる：

```
14:23:01 AI: Search "CLAS12 RG-K Lambda 1405 paper 2025"
         └─ 1. arxiv.org/2501.xxxxx          ← read
            2. journals.aps.org/prc/...      ← read
            3. inspirehep.net/literature/... ← skip
14:23:08 AI: Fetch journals.aps.org/prc/... (2,341 tok, 1.2s)
14:23:30 You: Navigate inspirehep.net/literature/...
14:23:45 You: Click "cited by 12"
```

Phase 3 までは primary pane、Phase 4 以降は Tab キーで show/hide する secondary pane。

#### Status bar

```
● connected │ 3 searches │ 5 pages │ 8,241 tokens │ 14.2s
```

### 2.3 キーバインド

Phase 毎の進化を含めた全キーバインド。現状 (Phase 3) は基本キーのみ、Phase 4+ で navigation が追加される。

| Phase  | Key       | Action                                              |
|--------|-----------|-----------------------------------------------------|
| P0–3   | Tab       | Log / Viewer ペイン切り替え                          |
| P0–3   | j/k / ↓/↑ | スクロール / ログエントリ選択                         |
| P0–3   | Enter     | 選択エントリをviewerで開く                           |
| P0–3   | o         | 外部ブラウザで現在ページを開く（安全弁）              |
| P0–3   | /         | Activity Log をフィルタ                              |
| P0–3   | s         | セッション統計モーダル                                |
| P0–3   | e         | セッションをJSON/Markdownにエクスポート               |
| P0–3   | q / Esc   | ペインを閉じる / アプリ終了                           |
| **P4** | g         | URL入力モード（URL bar focus）                       |
| **P4** | h / ←     | Back (history)                                      |
| **P4** | l / →     | Forward (history)                                   |
| **P4** | r         | Reload current page                                 |
| **P4** | t         | 新規 tab                                            |
| **P4** | w         | 現在 tab を閉じる                                   |
| **P4** | 1–9       | Tab 切り替え                                        |
| **P4** | f         | Link hint mode（Vimium風、リンクにラベルを表示しクリック） |
| **P5** | y         | URL or selection を copy                            |
| **P5** | b         | bookmark 追加                                       |
| **P5** | Ctrl-R    | History 検索                                        |

### 2.4 ユースケース

#### ケース1: 人間が直接 browse する（Phase 4+）

ターミナルで作業中、ドキュメントや論文を読みたい。`aispy` を開いて `g` で URL 入力。Chawan級のCSSレイアウトでページがレンダリングされる。リンクを辿り、複数tabで並行して読む。ブラウザを別窓で開かずに済む。

#### ケース2: AIの検索・取得をリアルタイムで監視

Claude Code が MCP 経由で `search` / `fetch` を呼ぶと、Activity Log に流れ、取得ページは新規 tab として Page Viewer に表示される。「今AIはこのページを読んでいる」が見える。

#### ケース3: AIと同じページを並読する

AIが fetch したページを人間も同時に読む。「AIの結論はこれだが、人間が見るとこのへんが怪しい」と気づいて Claude Code に補正指示を出す。人間とAIが同じrendering を共有するからできる協働。

#### ケース4: AIの検索戦略の補正

Activity Log で「AIがこのページをskipしたけど、これ大事じゃん」と気づいたら、Claude Codeに「3番の結果も読んで」と伝えて補正する。

#### ケース5: ページの確認と逃がし

TUI rendering で読みづらいページ（重いSPA、動画、インタラクティブ図）は `o` で実ブラウザに逃がせる。どのPhaseでも維持される安全弁。

---

## 3. 技術アーキテクチャ

### 3.1 全体構成

```
┌──────────────────────────────────────────────────────┐
│ tmux                                                 │
│                                                      │
│ ┌──────────────────────┐  ┌────────────────────────┐ │
│ │ Pane 1               │  │ Pane 2                 │ │
│ │ Claude Code          │  │ $ aispy                │ │
│ │                      │  │   ┌──────────────────┐ │ │
│ │   spawns ↓           │  │   │ TUI renderer     │ │ │
│ │ ┌──────────────────┐ │  │   │                  │ │ │
│ │ │ aispy --mcp      │─┼──IPC─→ Unix socket      │ │ │
│ │ │ (stdio MCP)      │ │  │   │ listen           │ │ │
│ │ │                  │ │  │   │                  │ │ │
│ │ │ search backend   │ │  │   │ Activity Log     │ │ │
│ │ │ fetch + convert  │ │  │   │ Page Viewer      │ │ │
│ │ └──────────────────┘ │  │   │ Status Bar       │ │ │
│ │   ↕ stdin/stdout     │  │   └──────────────────┘ │ │
│ │   JSON-RPC (MCP)     │  │                        │ │
│ └──────────────────────┘  └────────────────────────┘ │
└──────────────────────────────────────────────────────┘
```

2つのプロセスが連携する：
- **aispy --mcp**（Pane 1内、Claude Codeの子プロセス）: stdio MCP serverとしてsearch/fetchを実行し、結果をClaude Codeに返すと同時にUnix socket経由でTUIプロセスにイベントをforward
- **aispy**（Pane 2、手動起動）: TUI描画、socket listen、ユーザー操作（キーバインド）

### 3.2 なぜMCPサーバーとして実装するか

Claude Codeの内部動作を調査した結果、以下が判明している：

1. Claude Codeは`WebSearch`と`WebFetch`という2つの内部ツールを持つ
2. WebSearchはAnthropicのサーバーサイド`web_search_20250305`を呼ぶ（セカンダリOpus会話経由）
3. WebFetchはAxiosでローカルからHTTPで取得し、Haiku（セカンダリ会話）で処理する
4. **MCP提供のweb fetchツールが利用可能な場合、Claude CodeはビルトインのWebFetchよりそちらを優先する**（公式ドキュメントに明記）

この4番目が決定的に重要。aispyが`search`と`fetch`というMCPツールを提供すれば、Claude Codeは自動的にaispyを経由する。

### 3.3 MCPツール定義

```typescript
// search: ウェブ検索
{
  name: "search",
  description: "Search the web and return results with titles and URLs",
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string", description: "Search query" },
      count: { type: "number", description: "Max results", default: 10 }
    },
    required: ["query"]
  }
}

// fetch: ページ取得
{
  name: "fetch",
  description: "Fetch a web page and return its text content",
  inputSchema: {
    type: "object",
    properties: {
      url: { type: "string", description: "URL to fetch" },
      prompt: { type: "string", description: "What to extract from the page" }
    },
    required: ["url"]
  }
}
```

### 3.4 データフロー

```
Claude Code
  │
  ├── search(query: "CLAS12 Lambda 1405") ──→ aispy
  │                                            │
  │                                            ├── Brave API呼び出し
  │                                            ├── 結果をActivity Logに描画
  │                                            └── 結果をJSON形式でClaude Codeに返却
  │   ←── [{title, url, snippet}, ...]  ───────┘
  │
  ├── fetch(url: "https://arxiv.org/...") ──→ aispy
  │                                            │
  │                                            ├── Axios でHTTP GET
  │                                            ├── HTML → テキスト変換
  │                                            ├── Page Viewerに描画
  │                                            └── テキストをClaude Codeに返却
  │   ←── { content: "...", tokens: 2341 } ────┘
  │
  └── （Claude Codeが結果を使って回答を生成）
```

### 3.5 内部モジュール構成

Phase 3 時点の実構成。Phase 4 で navigation / tab 関連モジュールが `src/browser/` として追加される予定。

```
aispy/
├── src/
│   ├── index.ts                 # bin entry（shebang、MCP + TUI wire）
│   ├── mcp-server.ts            # MCP server entry（stdio）
│   ├── tui.tsx                  # Ink TUI entry（render(<App/>)）
│   ├── config.ts                # 設定（search backend、表示設定）
│   ├── types.ts                 # 横断的な型
│   ├── mcp/
│   │   ├── server.ts            # MCP server実装
│   │   └── tools/
│   │       ├── search.ts        # search tool
│   │       └── fetch.ts         # fetch tool
│   ├── search/
│   │   ├── index.ts             # backend ディスパッチ
│   │   ├── brave.ts             # Brave Search API
│   │   ├── serper.ts            # Serper.dev
│   │   ├── tavily.ts            # Tavily
│   │   └── types.ts
│   ├── ipc/
│   │   ├── server.ts            # Unix socket server（TUI 側）
│   │   ├── client.ts            # Unix socket client（MCP 側）
│   │   └── protocol.ts          # JSON message 定義
│   ├── core/
│   │   ├── store.ts             # EventStore（subscribe/publish）
│   │   ├── htmlToText.ts        # readability + Turndown
│   │   ├── cssResolver.ts       # CSS parse + cascade（Phase 3）
│   │   ├── flexLayout.ts        # flexbox layout engine（Phase 3）
│   │   ├── htmlRenderer.ts      # layout → cell grid（Phase 3）
│   │   ├── fetchCache.ts        # URL → content LRU
│   │   ├── sessionFile.ts       # session persistence
│   │   ├── exportSession.ts     # JSON / Markdown export
│   │   └── browserOpen.ts       # 外部ブラウザ起動
│   └── ui/
│       ├── App.tsx
│       ├── types.ts
│       ├── formatTime.ts
│       ├── components/
│       │   ├── ActivityLog.tsx
│       │   ├── PageViewer.tsx
│       │   ├── StatusBar.tsx
│       │   ├── SearchEntry.tsx
│       │   ├── FetchEntry.tsx
│       │   ├── FilterInput.tsx
│       │   └── StatsModal.tsx
│       ├── hooks/
│       │   ├── useEventStore.ts
│       │   └── useKeyboard.ts
│       └── contexts/
│           └── StoreContext.tsx
├── tests/                       # integration test
├── package.json
├── tsconfig.json
└── eslint.config.js
```

Phase 4 で追加予定（`src/browser/`）:

```
│   ├── browser/
│   │   ├── history.ts           # back/forward history stack
│   │   ├── tabs.ts              # tab state management
│   │   ├── navigator.ts         # URL resolve + fetch + render orchestration
│   │   └── linkHints.ts         # Vimium風 link label mode
```

---

## 4. 技術スタック

| コンポーネント         | ライブラリ/ツール                    | 理由 / 用途                                                        |
|------------------------|--------------------------------------|--------------------------------------------------------------------|
| 言語                   | TypeScript                           | MCP SDK, Ink が first-class。AI coding agent の TUI はほぼ全て TS  |
| MCPサーバー            | @modelcontextprotocol/sdk            | 公式 SDK、stdio transport                                          |
| TUI                    | Ink (React for terminals)            | Claude Code, Gemini CLI 等と同じ構成                              |
| 検索 backend           | Brave / Serper / Tavily              | 複数対応。`src/search/` で dispatch。config で切替                 |
| HTTP 取得              | Axios                                | Claude Code 内部実装と同じ                                         |
| HTML parser            | jsdom                                | CSS selector 適用と DOM tree 走査に使用                            |
| CSS parser             | css-tree                             | CSS 構文解析。`src/core/cssResolver.ts` で使用                    |
| Layout engine          | 独自実装（flow + flexbox）            | `src/core/flexLayout.ts`。Chawan 参考                             |
| Rendering              | 独自実装（cell grid → Ink）           | `src/core/htmlRenderer.ts`。CJK / 全角対応                        |
| Readability 抽出       | @mozilla/readability                 | reader mode。Phase 2 導入済み                                      |
| HTML→Markdown          | Turndown                             | reader mode の fallback                                            |
| 設定                   | dotenv + zod                         | `.env` + runtime validation                                        |
| テスト                 | Vitest                               | colocated unit test + tests/ integration                           |
| Lint                   | ESLint (flat config)                 |                                                                    |
| パッケージ管理         | npm                                  | `npm install -g aispy` で配布                                      |
| Phase 3.5 で追加予定   | parse5（HTML5 準拠 parser に差替）     | layout 用は jsdom 重い、parse5 + 自前 DOM wrapper の hybrid         |
| Phase 3.7 で追加予定   | sharp（画像 decode、native）           | PNG/JPEG/WebP → raw pixels                                         |
| Phase 3.7 で追加予定   | Kitty graphics protocol（自前 serializer）| APC escape + base64 + 4KB chunk                                 |
| Phase 3.7 で追加予定   | Sixel encoder（fallback）              | Kitty 非対応端末向け                                                |
| Phase 7+ 将来候補      | QuickJS / node:vm                    | JS 実行（限定的に導入検討）                                         |

### 4.1 CSS TUI レンダリング（Phase 3、進行中）

Chawan（Nim で書かれた TUI ブラウザ、public domain）の CSS layout engine 設計を TypeScript で再構成している。Phase 3 で flow / block / inline / flexbox までを実装。

実装済み:

- **CSS parse + cascade** (`src/core/cssResolver.ts`) — css-tree で stylesheet を解析し、specificity 順に declaration をマージして computed style を出す
- **Flex layout engine** (`src/core/flexLayout.ts`) — flexbox に対応した layout 計算（main axis / cross axis、justify-content / align-items / flex-wrap / flex-grow）
- **Cell grid renderer** (`src/core/htmlRenderer.ts`) — layout tree を文字セルグリッドにマップ、CJK / 全角文字の幅計算、word wrap
- **Readability fallback** (`src/core/htmlToText.ts`) — 複雑なサイトで CSS レンダリングが厳しい場合の reader mode

未実装（後回し）:

- table layout（display: table, table-cell）
- CSS grid layout
- position: absolute / fixed
- Sixel / Kitty protocol による inline image
- JavaScript 実行（当面なし、§7.6 参照）

### 4.2 ブラウザ state 管理（Phase 4 で追加予定）

人間が直接 navigate できる browser になるため、以下の state を管理する:

- **History**: back/forward stack per tab
- **Tabs**: 複数の page context を並行保持、active tab を切替
- **Session**: cookie（最低限、httpOnly 不要）、sessionStorage は省略
- **Bookmarks** (Phase 5)

State は `useState` + `useRef` + Context で管理（coding conventions §state management に準拠）。

---

## 5. Claude Codeの内部WebSearch/WebFetch調査結果

### 5.1 WebSearch

- Anthropicのサーバーサイド`web_search_20250305`ツールを使用
- セカンダリLLM会話（Opus）を経由して実行
- 返却されるフィールド: title, url, page_age, encrypted_content
- Claude Codeはtitle, urlだけを使い、他のフィールドは捨てている
- 1回のtool callで最大8回の検索を実行可能
- クエリに現在の年月を自動付与する仕組みがある
- 結果の末尾に「Sources:セクションを必ず含めよ」というリマインダーがハードコードされている

### 5.2 WebFetch

- Anthropicのサーバーサイドツールは使わず、Axiosでローカルから取得
- HTML → Markdown変換（Turndown）
- セカンダリHaiku会話でコンテンツを処理（125文字のquote上限つき）
- 100Kトークンで切り詰め、tool result予算は50K（超過時は2KBプレビュー）
- 15分のLRUキャッシュ（50MBサイズ制限）
- 119のpre-approvedドメイン（ドキュメントサイト等）がある
- MCP提供のfetchツールがある場合、Claude Codeはそちらを優先

### 5.3 コスト構造

ビルトインWebSearchは毎回セカンダリOpus会話を生成するため、検索1回あたり約$0.10-0.15のオーバーヘッド。aispyが直接Brave APIを叩けば、このセカンダリ会話コストが不要になる。WebFetchも同様にHaikuのセカンダリ会話コストを削減できる。

つまりaispyは「可視化ツール」であると同時に「コスト最適化ツール」にもなりうる。

---

## 6. 開発フェーズ

Phase 4 以降は TUI Browser pivot に伴う新規フェーズ。詳細な根拠は `concepts/tui-browser-pivot.md`。

### Phase 0 ✓ 最小MCPサーバー

Claude Code に接続して search / fetch のログがターミナルに流れる最小実装。MCP 骨格 + Brave API + Turndown。**完了**。

### Phase 1 ✓ Ink TUI

Activity Log + Page Viewer + StatusBar + キーバインド。`o` キーによる外部ブラウザ起動。**完了**。

### Phase 2 ✓ コンテンツ品質向上

@mozilla/readability による main content 抽出、ANSI カラー、fetch cache、filter、stats modal、read/skip labels、セッション export（JSON / Markdown）。**完了**。

### Phase 3 CSS レイアウト対応レンダリング（進行中）

目標: Chawan級の CSS layout 対応で reader mode 以外の通常ページも TUI で読める水準にする。

- ✓ CSS parse + cascade（`src/core/cssResolver.ts`）
- ✓ Flexbox layout engine（`src/core/flexLayout.ts`）
- ✓ Cell grid renderer（`src/core/htmlRenderer.ts`）、CJK / 全角対応、word wrap
- ✓ SPA fallback（JS 必須ページでは reader mode に切替）
- ✓ 複数 search backend（Brave / Serper / Tavily）

Phase 3 は現状の htmlRenderer（DOM を直接 walk）の範囲で実用的に読める水準に達したら完了とする。Chawan 級の rendering 精度（table / float / IFC / images）は Phase 3.5 以降で段階的に実装。

### Phase 3.5 Box tree + Inline Formatting Context（次、pivot の rendering 基盤）

目標: Chawan の rendering pipeline と同じ 3 段構造（DOM → Box tree → Layout → Render）に整理する。全後続拡張の前提。詳細な設計参照は `concepts/chawan-analysis.md`。

Steps:

1. **Box tree 正規化層** (`src/core/boxTree.ts`) — cssResolver 結果を `CSSBox` / `BlockBox` / `InlineBox` / `InlineTextBox` / `InlineNewLineBox` の discriminated union tree に変換。anonymous box 生成（table outer/inner 分離、block-in-inline 分割、`::before`/`::after`/`::marker`/`::-cha-link-hint` pseudo 挿入）
2. **Inline Formatting Context** (`src/core/ifc.ts`) — `LineBoxState`（atoms linked list、baseline、size）、line breaking（CJK / Latin の折り返し）、vertical-align、inline-block 混在、white-space 適切処理、text decoration nesting
3. **Table layout** (`src/core/tableLayout.ts`) — 4-pass（preLayoutTableColspan → preLayoutTableRows → calcSpecifiedRatio → cell re-layout）
4. **Floats** — Phase 7+ に deferred。aispy の target 用途（docs / arxiv / blog）では float 使用頻度が低く、full 実装（Exclusion list + `findNextFloatOffset` + clear）のコストに見合わない。float 指定要素は normal flow でレンダリングされる（破綻はしない）
5. **FlexibleGrid 中間表現** (`src/core/flexibleGrid.ts`) — `FlexibleLine[]`（line = string + sparse `FormatCell[]`）。link hitbox を `FormatCell.node` として埋め込み、別 R-tree 不要
6. **htmlRenderer を layout engine に差し替え** — 既存は「DOM → cells」、新は「DOM → BoxTree → Layout → FlexibleGrid → Ink」

触るファイル:
- 新規: `src/core/boxTree.ts`, `src/core/layout.ts`, `src/core/ifc.ts`, `src/core/tableLayout.ts`, `src/core/floats.ts`, `src/core/flexibleGrid.ts`
- 既存修正: `src/core/htmlRenderer.ts`（差し替え）、`src/core/cssResolver.ts`（Element.computed への直付け対応）、`src/core/flexLayout.ts`（新 Box tree と整合）

成果物: arxiv、MDN、Wikipedia、GitHub docs、news 系で table / float / 複雑な inline も破綻なくレンダリング。`o` の頻度が大幅に減る。

非対応（次 Phase）:
- `position: absolute/fixed/sticky` の完全実装
- `keepLayout` caching（正確性優先、最適化は後）
- inline image の box 配置 → Phase 3.7

### Phase 3.7 Kitty Unicode Placeholders Image Rendering（v2 完了、2026-04-15）

目標: `<img>` を Kitty graphics protocol で terminal に描画し、inline 画像が本文中に破綻なく配置される。

#### v1（2026-04 前半、gallery mode のみ）

- ✓ Terminal capability detection (`src/core/termCapability.ts`)
- ✓ Image fetch + decode (`src/core/imageDecoder.ts`、axios + sharp)
- ✓ 画像 LRU cache + concurrency-4 prefetch worker (`src/core/imageStore.ts`)
- ✓ Kitty APC serializer (`src/core/imageProtocol.ts`、4KB chunked、`C=1, q=2`)
- △ 本文末尾の gallery mode（画像が縦並び、inline 配置は壊れる）
- △ `C=1` + 同一 line 複数 prepend で重なり

#### v2（2026-04-15、Unicode Placeholders 採用）

Kitty Unicode Placeholders protocol に移行。`C=1` の同一行重なりと gallery dedupe の両方を根本解決。

変更:

1. **Virtual image upload** — `a=T, U=1, q=2` で画像を terminal に保存するが描画しない。`encodeKittyVirtualUpload(img, id)` で実装。
2. **Placeholder cell** — `U+10EEEE` + combining diacritic 2 個（row, col を encode）+ 24-bit fg color に image ID。`encodeKittyPlaceholder(row, col)` を生成、Format.fgTrueColor = id を設定。
3. **`FlexibleGrid` 拡張** — `charWidth` に combining mark ranges（U+0300-036F 等）を追加して幅 0 扱い。`Format` に `fgTrueColor?: number` 追加。
4. **`paint.paintImage`** — 画像を w×h の placeholder cell 矩形として setText で書き込む。gallery mode 削除。
5. **`ansiSerializer.fgSeq`** — fgTrueColor を `\e[38;2;R;G;B m` で emit。
6. **`htmlRenderer`** — grid 出力前に `getUploadEscapes(protocol)` で全登録画像の virtual upload APC を prepend。

触ったファイル:
- 新規: `concepts/kitty-unicode-placeholders.md`（design note）
- 修正: `core/imageProtocol.ts`, `imageStore.ts`, `paint.ts`, `flexibleGrid.ts`, `ansiSerializer.ts`, `htmlRenderer.ts`, `ifc.ts`, `bfc.ts`, `buildBoxTree.ts`

v2 の成果物: Ghostty で MDN / Wikipedia / arxiv の inline 画像が本文中に複数並んで破綻なく表示される。

#### 非対応 / 後続 Phase

- **iTerm2**: OSC 1337 経路（`encodeITerm2`）を維持、Unicode Placeholders は非対応
- **Sixel**: 未実装（Phase 7+）
- **block-in-inline split**: `<a><img></a>` 等の IFC fallback 不整合は Phase 7+ で解消
- **Rate limit**: `upload.wikimedia.org` 429 対応は Phase 7+（decode 成功率 improvement）

### Phase 4 Interactive Browser Mode（pivot の中核）

目標: 人間が直接 browse できる TUI browser にする。AI fetch と人間 navigation が同じ tab 空間を共有する。

Step 順:

1. **URL bar + navigate**: `g` キーで URL 入力、Enter で fetch → Page Viewer 表示。最小の "browser っぽさ"
2. **History**: back/forward stack、`h` / `l` キー、`r` reload
3. **Tab 管理**: 複数 page 並行保持、`t` 新規 tab、`w` close、`1-9` 切替、Tab bar UI
4. **Link hints**: Vimium 風に `f` で link にラベル表示、キー選択で navigate
5. **AI / 人間の tab 統合**: AI fetch が新規 tab として入る、Activity Log と tab の紐付け

触るファイル（新規）:
- `src/browser/history.ts`, `tabs.ts`, `navigator.ts`, `linkHints.ts`
- `src/ui/components/UrlBar.tsx`, `TabBar.tsx`
- `src/ui/hooks/useNavigator.ts`, `useTabs.ts`

成果物: Chawan / Browsh と機能競合できる TUI browser。MCP integration は標準装備。

### Phase 5 Polish

目標: 「TUI browser として名乗れる完成度」まで仕上げる。

- Form input（input / textarea / select、GET/POST submit）
- Bookmarks（local JSON persistence）
- History 検索（Ctrl-R）
- Session 管理（cookie 最低限、per-origin）
- 設定画面（`:config` or `.aispy/config`）
- ヘルプ画面（`?` キー）
- Keybinding の vimium 互換モード / emacs モード

成果物: 日常使いできる TUI browser。

### Phase 6 Production / Ecosystem

- npm 公開（`npm install -g aispy`）
- 複数 AI client 対応の検証（Claude Code, Cursor, Gemini CLI, OpenCode, Amp 等）
- Integration with Chrome DevTools MCP / Playwright MCP（共存 pattern）
- ドキュメント + sample workflow + screencast
- バイナリ配布（pkg or bun compile で single binary）

### Phase 7+ 野心項目（将来）

- JavaScript 実行（QuickJS / node:vm、限定的に）
- CSS grid layout
- Web Components / Shadow DOM
- `keepLayout` caching による incremental re-layout の最適化
- Multi-window / Pane split（1 terminal で複数 viewer）
- `position: absolute/fixed/sticky` の完全実装

---

## 7. 設計原則

### 7.1 AIにとっては透明

aispyのMCPツールは、AIから見ると普通の search / fetch ツール。AIは aispy を意識する必要がない。可視化と人間の browsing は完全にサイドエフェクト。

### 7.2 人間にとっては直感的

Vimium / tmux に馴染みのある key ベース操作。`g` で URL、`h`/`l` で history、`f` で link hint、`t` で tab。モード切替は最小限（URL 入力 / link hint 選択 / 通常）。

### 7.3 段階的に価値が上がる

Phase 0 で「何を検索したか見える」だけで価値がある。Phase 1 で「ページの中身が見える」。Phase 2 で「きれいに見える」。Phase 3 で「reader として実用」。Phase 3.5 で「table / float / 複雑な inline が破綻なくレンダリング」。Phase 3.7 で「画像が見える」。Phase 4 で「人間も browse できる TUI browser」。Phase 5 で「日常使いできる」。各フェーズで出荷可能。

### 7.4 `o` キーが設計の安全弁

TUI rendering がどのフェーズでも完璧ではない。`o` で実ブラウザに逃がせる設計により、初期リリースのハードルが下がり、SPA / 動画 / 重いインタラクションでも詰まらない。

### 7.5 人間とAIが同じ viewer を共有

AI が fetch したページは人間が直接読める rendering で viewer に入る。人間が開いたページを AI は MCP 経由で同じ content として読む。pixel / DOM / screenshot を経由しない、text が単一の真実。これが「AI 時代の TUI browser」の核。

### 7.6 JS 実行は当面しない

aispy の初期 scope は static HTML + CSS + form (GET/POST) まで。動的 DOM の TUI 反映はコストが重く、対象 persona（docs / arxiv / blog / news を読む開発者）にとって多くのサイトが JS なしで読める。SPA は `o` で逃がす。JS は Phase 7+。

### 7.7 Chawan を fork せず独立実装

Chawan は Nim 単一バイナリで Ink 生態系に入れない。aispy は Chawan の CSS engine design を参考に TS で独立実装し、`src/core/` 以下に置く。Chawan 自体の価値は否定せず、design reference として credit する。

---

## 8. 市場ポジショニング

2025–2026 年の landscape 分析は `concepts/2026-landscape-and-positioning.md`、pivot 根拠は `concepts/tui-browser-pivot.md` を参照。

### 8.1 既存ツールとの差別化

| 分類                     | 代表ツール                             | aispy との違い                                              |
|--------------------------|----------------------------------------|-------------------------------------------------------------|
| OSS actor (SDK)          | browser-use, Stagehand, Skyvern        | AI に操作させる SDK。人間は primary でない                  |
| Actor MCP                | Playwright MCP, Chrome DevTools MCP    | AI が browser を動かす基盤。人間は読めない                  |
| Foundation-model actor   | Claude for Chrome, ChatGPT Agent/Atlas, Gemini CU | 実 browser / VM で AI が動く。重量、pixel / DOM 主体   |
| Personal AI agent        | OpenClaw, hermes-agent                 | Messaging 経由で自律タスク。browser はその 1 tool           |
| Consumer AI browser      | Comet, Dia, Neon, Edge Copilot, Leo    | Standalone app。GUI / non-terminal                         |
| TUI browser (human)      | Chawan (Nim), Browsh (Firefox 寄生)    | 人間専用。AI 連携なし、Ink 生態系外                         |
| Agent observability      | Langfuse, LangSmith, Braintrust        | LLM trace の汎用基盤。Web dashboard                         |
| Terminal observability   | otel-tui, claude-view, ccboard         | Trace / session 監視。browser rendering なし                |
| **aispy**                | **TUI browser + MCP**                  | **Chawan 級 rendering + AI 連携 first-class + Ink 生態系** |

競合が一番近いのは Chawan だが、aispy の優位性は (a) TypeScript / Ink ecosystem への first-class 所属、(b) AI 連携が後付けでなく core 設計、(c) Claude Code 等との同一 terminal 動作。人間の browsing に限れば Chawan が強いが、AI 時代の新要件（reader と AI が同じ viewer を共有、MCP standard、coding agent 連携）で aispy が優位。

### 8.2 ターゲットユーザー

1. **Claude Code / Cursor / Gemini CLI 等を使う開発者** — ターミナル内で documentation / arxiv / docs / GitHub を読み、かつ AI が何を fetch しているか見たい人
2. **AI agent の挙動をデバッグしたい開発者** — OpenClaw / hermes-agent / Managed Agents で自律タスクを走らせて、agent が参照している page を人間も並読したい人
3. **Power user / tmux user** — Browsh / Chawan では Ink 生態系から外れてしまうが、終日ターミナルで作業する開発者で軽量 browser が欲しい人
4. **AI research コストを管理したい人** — fetch を MCP で直接行えば Claude Code 内蔵 WebFetch の Haiku secondary conversation コストが削減できる（§5.3）

### 8.3 配布

```bash
npm install -g aispy
aispy                        # TUI browser として起動
claude mcp add aispy -- aispy --mcp    # AI 連携も有効にする
```

2–3 コマンドで「TUI browser」と「AI 連携 MCP」の両方が使える状態になる。

### 8.4 MCP platform 化と actor MCP との共存

2026 年時点で MCP は agent connector の事実上の標準（Chrome 146 WebMCP、Opera Neon MCP Connector、Playwright MCP CLI、Anthropic Managed Agents）。aispy は:

- **自分は reader layer** に居る。`search` / `fetch` を提供する
- **actor MCP (Playwright MCP、Chrome DevTools MCP) と layer が異なる** ため共存可能
- AI は「軽い取得・閲読」を aispy に、「重い操作（click / form / JS）」を actor MCP に振り分ける
- 人間は aispy の viewer で rendering された text を読む

詳細は `concepts/actor-mcp-coexistence.md`（旧 passive observer 前提だが、共存設計の骨子は有効）。

---

## 9. 背景調査メモ

### 9.1 WebMCPについて

Chrome 146 で WebMCP が導入されつつある（2026 年 2 月、early preview）。サイトが `navigator.modelContext` 経由で agent 向け構造化 tool を公開する仕組み。W3C 標準化プロセスの初期段階。

aispy は client 側から MCP call を log できる側に居るため、WebMCP が普及したら「WebMCP invocation を aispy の viewer / activity log に出す」形で capture 可能。競合ではなく capture 対象。

### 9.2 TUI browserの技術的知見

- CSS レイアウトエンジンをスクラッチで書くのは膨大な作業（Chawan は 1 人が数年かけて開発）。aispy は段階的にやる
- yoga-layout（Meta 製）が flexbox の独立実装として存在し、Node.js バインディングがある。Phase 7+ の置換候補
- TypeScript + Ink の組み合わせが、AI ツールの TUI 実装のデファクトスタンダード（Claude Code, OpenCode, Amp, Gemini CLI が全て採用）
- Chawan（public domain）の CSS engine 設計を参考に TS で独立実装している（§7.7）
- JS 実行は難問。当面は static HTML に限定し、SPA は `o` キーで外部に逃がす戦略（§7.6）

### 9.3 Pivot 履歴

2026-04-14 に "passive observer" positioning から "AI 時代の TUI browser" へ pivot。根拠 / 判断は `concepts/tui-browser-pivot.md`、2026 landscape 調査は `concepts/2026-landscape-and-positioning.md`。
