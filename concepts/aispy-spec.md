# aispy — AI Search Process Visualizer

## TL;DR

aispyは、AIエージェント（Claude Code等）のウェブ検索・ページ取得プロセスをリアルタイムで可視化するTUIアプリケーション兼MCPサーバー。AIが何を検索し、何を読み、何を抽出したかがターミナルに流れる。「AIの目」を人間と共有する。

---

## 1. コンセプト

### 1.1 解決する問題

Claude Codeが`Searching...`と表示しているとき、人間には何が起きているかわからない。どんなクエリを投げたか、何件ヒットしたか、どのページを読んだか、何を捨てたか。結果だけがポンと返ってくる。

これはCLI操作では既に解決されている。tmux越しにAIがコマンドを実行すれば、`grep`の出力もnvimの編集もリアルタイムで見える。ウェブ検索だけが「ブラックボックス」のまま残っている。

### 1.2 根本的な洞察

> 人間とAIがどちらも理解できるinterfaceで、かつテキストベースであるためデータ量が軽量。

スクリーンショットベースのブラウザ操作（Claude in Chrome等）は、画像のエンコード→VLM推論→次のアクション、の1サイクルが重い。操作ステップが増えるほどスクショの回数が増えるだけ。テキストベースなら同じ情報をトークン1/10以下で表現でき、人間にも読める。

### 1.3 aispyのポジション

aispyは「AIがウェブを操作するためのブラウザ」ではない。**「AIがウェブから何を読んでいるか、人間が覗き見するためのモニター」**である。

AIにとってはJSON形式のMCPツール。人間にとってはTUI画面。見ているデータは同じ。

---

## 2. プロダクト設計

### 2.1 起動と接続

```bash
$ aispy
```

起動するとTUI画面が表示され、同時にMCPサーバー（stdio）として待ち受ける。

Claude Codeの設定（`~/.claude.json`）に追加：

```json
{
  "mcpServers": {
    "aispy": {
      "command": "aispy",
      "env": {
        "BRAVE_API_KEY": "your-brave-api-key"
      }
    }
  }
}
```

### 2.2 画面構成

TUI画面は3つのエリアに分かれる：

```
╔═══════════════════════════════════════════════════════════╗
║  aispy                                    ● connected    ║
╠═══════════════════════╦═══════════════════════════════════╣
║                       ║                                   ║
║  Activity Log         ║  Page Viewer                      ║
║                       ║                                   ║
║  検索クエリ           ║  AIが今読んでいるページの          ║
║  結果一覧             ║  テキストレンダリング              ║
║  AIの行動             ║                                   ║
║  が時系列で流れる     ║  人間もスクロールして              ║
║                       ║  中身を確認できる                  ║
║                       ║                                   ║
╠═══════════════════════╩═══════════════════════════════════╣
║  Status: 3 searches | 5 pages read | 8,241 tokens        ║
╚═══════════════════════════════════════════════════════════╝
```

#### 左ペイン: Activity Log

AIの行動が時系列で流れる（最新が下）：

```
14:23:01 ── Search #1 ────────────────────────
Q: "CLAS12 RG-K Lambda 1405 paper 2025"

  1. arxiv.org/2501.xxxxx          ← read
     "Λ(1405) photoproduction..."
  2. journals.aps.org/prc/...      ← read
     "Electroproduction of Λ..."
  3. inspirehep.net/literature/... ← skip
     "K-p interaction near..."

14:23:08 ── Fetch [2] ─────────────────────────
journals.aps.org/prc/abstract/10.1103/...
2,341 tokens | 1.2s

14:23:12 ── Search #2 ────────────────────────
Q: "sWeight sPlot topology separation"
  ...
```

- searchエントリ: クエリ + 結果一覧（read/skipラベル付き）
- fetchエントリ: URL + トークン消費 + 所要時間
- エントリにカーソルを合わせてEnterで右ペインにプレビュー

#### 右ペイン: Page Viewer

AIが読んでいるページ、または人間が選択したページのテキスト表示：

```
┌─ journals.aps.org/prc/abstract/... ──────────┐
│                                               │
│ Electroproduction of Λ(1405)                  │
│ with CLAS12 at Jefferson Lab                  │
│                                               │
│ A. Smith, B. Jones, C. Williams,              │
│ ... and the CLAS Collaboration                │
│                                               │
│ Phys. Rev. C 109, 015201 (2025)               │
│ Published: November 15, 2025                  │
│                                               │
│ ──────────────────────────────────────────    │
│                                               │
│ Abstract:                                     │
│ We report the first measurement of            │
│ Λ(1405) electroproduction using the           │
│ CLAS12 detector at Jefferson Lab...           │
│                                               │
└───────────────────────────────────────────────┘

[j/k scroll] [o open in browser] [q back]
```

- j/k: スクロール
- o: 実際のブラウザでURLを開く（重要：TUIの表示品質が不十分でも、ここで逃がせる）
- q: ログに戻る

#### ステータスバー

```
● connected | 3 searches | 5 pages | 8,241 tokens | 14.2s
```

セッション全体の統計。トークン消費量が可視化される。

### 2.3 キーバインド

| Key   | Action                                        |
|-------|-----------------------------------------------|
| Tab   | 左右ペイン切り替え                            |
| j/k   | スクロール                                    |
| Enter | ログエントリのページをプレビュー              |
| o     | 今見てるページを外部ブラウザで開く            |
| /     | ログをフィルタ（クエリで絞り込み）            |
| s     | セッション統計の詳細表示                      |
| q     | Page Viewerから戻る / アプリ終了確認          |

### 2.4 ユースケース

#### ケース1: 検索の監視

AIが検索を実行するたびに、Activity Logにクエリと結果が流れる。「こういうクエリで検索したんだ」「この結果を選んだんだ」がリアルタイムでわかる。

#### ケース2: ページの確認

AIが読んでいるページをPage Viewerでさっと確認。タイトル・著者・Abstractが見えれば十分。詳しく見たければ`o`で実ブラウザに逃がす。

#### ケース3: AIの検索戦略の補正

Activity Logで「AIがこのページをskipしたけど、これ大事じゃん」と気づいたら、Claude Codeに「3番の結果も読んで」と伝えて補正する。

---

## 3. 技術アーキテクチャ

### 3.1 全体構成

```
┌──────────────────────────────────────────────────┐
│ tmux                                             │
│                                                  │
│ ┌──────────────────┐  ┌───────────────────────┐  │
│ │ Pane 1           │  │ Pane 2                │  │
│ │ Claude Code      │  │ aispy --tui           │  │
│ │                  │  │                       │  │
│ │ MCPで接続 ───────┼──┼→ aispy MCP server     │  │
│ │                  │  │   │                   │  │
│ │                  │  │   ├→ search backend    │  │
│ │                  │  │   ├→ fetch + convert   │  │
│ │                  │  │   └→ TUI renderer      │  │
│ └──────────────────┘  └───────────────────────┘  │
└──────────────────────────────────────────────────┘
```

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

```
aispy/
├── src/
│   ├── index.ts              # エントリポイント: MCP server + TUI起動
│   ├── mcp/
│   │   ├── server.ts         # MCP server実装 (@modelcontextprotocol/sdk)
│   │   ├── tools/
│   │   │   ├── search.ts     # searchツール（Brave API呼び出し）
│   │   │   └── fetch.ts      # fetchツール（Axios + HTML変換）
│   │   └── types.ts          # MCP関連の型定義
│   ├── tui/
│   │   ├── app.tsx           # Ink TUIルートコンポーネント
│   │   ├── components/
│   │   │   ├── ActivityLog.tsx    # 左ペイン
│   │   │   ├── PageViewer.tsx     # 右ペイン
│   │   │   ├── StatusBar.tsx      # ステータスバー
│   │   │   ├── SearchEntry.tsx    # 検索結果エントリ
│   │   │   └── FetchEntry.tsx     # ページ取得エントリ
│   │   └── hooks/
│   │       ├── useKeyboard.ts     # キーバインド処理
│   │       └── useStore.ts        # 状態管理
│   ├── core/
│   │   ├── store.ts          # アプリケーション状態（EventEmitterベース）
│   │   ├── html-to-text.ts   # HTML → テキスト変換パイプライン
│   │   └── browser-open.ts   # 外部ブラウザでURL起動
│   └── config.ts             # 設定（検索バックエンド、表示設定等）
├── package.json
├── tsconfig.json
└── README.md
```

---

## 4. 技術スタック

| コンポーネント       | ライブラリ/ツール                       | 理由                                                     |
|----------------------|-----------------------------------------|----------------------------------------------------------|
| 言語                 | TypeScript                              | MCP SDK, Inkがファーストクラスサポート。AI coding agentのTUIはほぼ全てTS |
| MCPサーバー          | @modelcontextprotocol/sdk               | 公式SDK。stdio transport                                 |
| TUIフレームワーク    | Ink (React for terminals)               | Claude Code, Gemini CLI等と同じ構成。コンポーネントベース |
| 検索バックエンド     | Brave Search API                        | 無料2,000回/月。公式MCPサーバーあり。品質安定             |
| HTTP取得             | Axios                                   | Claude Codeの内部実装と同じ                              |
| HTML→テキスト変換    | Turndown (HTML→Markdown)                | Claude Codeの内部実装と同じ。将来拡張の余地あり          |
| コンテンツ抽出       | @mozilla/readability                    | メインコンテンツの抽出。Phase 2で導入                    |
| パッケージ管理       | npm                                     | `npm install -g aispy` で配布                            |

### 4.1 将来のCSS TUIレンダリング

Page Viewerのテキスト表示品質は段階的に向上させる。将来的にはChawan（Nimで書かれたTUIブラウザ）のCSS layoutエンジン級のレンダリングを目指す。Chawanの特徴：

- 独自のCSS layoutエンジン（flow, table, flexbox対応）
- Nimでスクラッチから開発、メモリ安全
- HTML5パーサー（Chame）、QuickJSによるJS実行
- Sixel/Kitty protocolによるインライン画像
- Public domain（自由に利用可能）

ただし初期リリースではTurndown + Markdown表示で十分。`o`キーで実ブラウザに逃がせる設計により、TUI品質への依存度を下げている。

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

### Phase 0: 最小MCPサーバー（1週間）

目標: Claude Codeに接続して、searchとfetchのログがターミナルに流れる最小実装。

- MCPサーバー骨格（@modelcontextprotocol/sdk, stdio transport）
- searchツール: Brave Search API呼び出し → 結果をstderrにテキスト出力
- fetchツール: Axios + Turndown → コンテンツをstderrにテキスト出力
- Claude Codeに`claude mcp add`で接続して動作確認
- TUI描画なし。console.log/stderrレベル

成果物: Claude Codeから検索させると、ターミナルにクエリと結果がリアルタイムで流れる。

### Phase 1: Ink TUI（1-2週間）

目標: 左右ペイン、Activity Log、Page Viewer、キーバインドの実装。

- Ink (React for terminals) によるTUI画面
- 左ペイン: Activity Log（検索クエリ、結果一覧、fetch履歴）
- 右ペイン: Page Viewer（Markdown変換されたページテキスト）
- ステータスバー（統計情報）
- キーバインド: Tab, j/k, Enter, o, q
- `o`キーによる外部ブラウザ起動

成果物: tmuxの隣のペインで、AIの検索プロセスがリッチなTUIで可視化される。

### Phase 2: コンテンツ品質向上（2週間）

目標: Page Viewerのテキスト表示品質を実用レベルに引き上げる。

- @mozilla/readability によるメインコンテンツ抽出
- HTMLのセマンティック構造を保ったテキスト変換（見出し、リスト、テーブル、リンク）
- ANSIカラーによるシンタックスハイライト（見出し、リンク、コードブロック）
- ページ取得のキャッシュ（同じURL再取得の回避）

成果物: ページプレビューの品質が大幅に向上し、`o`の頻度が減る。

### Phase 3: CSSレイアウト対応レンダリング（将来）

目標: Chawan級のCSS layout対応TUIレンダリング。

- CSSパーサー（css-tree）+ スタイル解決
- レイアウトエンジン（yoga-layoutベースでflexbox対応、または独自flow layout）
- レイアウト結果の文字グリッドへのマッピング
- ボックス描画文字によるボーダー、ANSIカラーによる背景色

成果物: TUI内でほぼ完全にページが読める。`o`がほぼ不要になる。

### Phase 4: プロダクション品質（継続）

- npm公開（`npm install -g aispy`）
- 複数検索バックエンド対応（Brave, Tavily, Perplexity等を設定で切り替え）
- 複数AIクライアント対応の検証（Claude Code, Cursor, Gemini CLI等）
- セッションのエクスポート（検索履歴をJSON/Markdownで保存）
- ドキュメント + サンプルワークフロー

---

## 7. 設計原則

### 7.1 AIにとっては透明

aispyのMCPツールは、AIから見ると普通のsearch/fetchツール。AIはaispyを意識する必要がない。可視化は完全にサイドエフェクト。

### 7.2 人間にとっては直感的

Activity Logは時系列で上から下に流れる。Page Viewerはj/kスクロール + oで外部ブラウザ。tmuxユーザーに馴染みのある操作体系。

### 7.3 段階的に価値が上がる

Phase 0でも「何を検索したか見える」だけで価値がある。Phase 1で「ページの中身が見える」。Phase 2で「きれいに見える」。Phase 3で「ブラウザなしで読める」。各フェーズで出荷可能。

### 7.4 `o`キーが設計の安全弁

TUIのテキスト表示品質がどのフェーズでも、`o`で実ブラウザに逃がせる。これにより初期リリースのハードルが大幅に下がる。

---

## 8. 市場ポジショニング

### 8.1 既存ツールとの差別化

| ツール         | アプローチ                | aispyとの違い                               |
|----------------|---------------------------|---------------------------------------------|
| Browser Use    | Playwright + DOM蒸留     | AI操作用。人間の監視は副次的                |
| Browsh         | Firefox→テキスト変換     | 人間のブラウジング用。AI連携なし            |
| Chawan         | 独自CSS engine TUI       | 人間のブラウジング用。AI連携なし            |
| Brave MCP      | 検索結果をMCPで提供      | 可視化なし。結果がAIに返るだけ              |
| **aispy**      | **MCP + TUI可視化**      | **AIの情報収集を人間がリアルタイムで監視** |

### 8.2 ターゲットユーザー

1. Claude Code/Cursor等を使う開発者で、AIの検索プロセスを監視したい人
2. AI agentの挙動をデバッグしたい開発者
3. AIによるリサーチタスクのコスト管理をしたい人

### 8.3 配布

```bash
npm install -g aispy
claude mcp add aispy -- aispy
```

2コマンドで使い始められる。

---

## 9. 背景調査メモ

### 9.1 WebMCPについて

Chrome 146でWebMCPが導入されつつある（2026年2月、early preview）。ウェブサイト側が`toolname`属性でagent向けインターフェースを宣言する仕組み。W3C標準化プロセスの初期段階。

WebMCPは「サイトがagentに協力する世界」の標準。aispyは「サイトが協力しなくても人間がAIの検索を監視できる」ツール。補完関係にあり、競合しない。WebMCPが普及しても、AIが何を見ているかの可視化ニーズは残る。

### 9.2 TUI browserの技術的知見

- CSSレイアウトエンジンをスクラッチで書くのは膨大な作業（Chawanは1人が数年かけて開発）
- yoga-layout（Meta製）がflexboxの独立実装として存在し、Node.jsバインディングがある
- TypeScript + Inkの組み合わせが、AIツールのTUI実装のデファクトスタンダード（Claude Code, OpenCode, Amp, Gemini CLIが全て採用）
- Phase 3でCSS対応を入れる際には、Chawan（public domain）の設計を参考にできる
