# Chawan rendering engine 解析

aispy TS 再実装のための high-level blueprint。Chawan (Nim, public domain) の rendering pipeline を直接 source 読解で解析した結果。調査日: 2026-04-14。

参照: [sourcehut-mirrors/chawan](https://github.com/sourcehut-mirrors/chawan)、`doc/architecture.md`、`doc/css.md`。

---

## 1. 全体アーキテクチャ

### 1.1 プロセスモデル（aispy は単一プロセス化）

Chawan は buffer プロセスが HTML bytes → DOM → style → layout → render を丸ごと所有し、pager は cell grid だけを socket 越しに受ける設計。aispy は Node 単一プロセスだが、**パイプラインを独立 module に切り分ける境界線** は同じ分解を採用する。

### 1.2 モジュール分解

| Chawan dir | 役割 | aispy での対応 |
|-----|------|----------------|
| `src/html/` | DOM ノード型、Chame adapter、form、JS bindings | `core/` 内の DOM wrapper (parse5 化検討) |
| `src/css/` | CSS parse、cascade、box tree、layout、render | `core/cssResolver.ts`, `core/flexLayout.ts`, `core/htmlRenderer.ts` |
| `src/server/buffer.nim` | pipeline orchestrator | `core/htmlToText.ts` |
| `src/local/` | Pager TUI、terminal driver、line edit | `ui/` |
| `src/types/` | cell、color、URL、blob の共通型 | `types.ts` |

### 1.3 外部依存と「自作の境界」

- **Chame** (HTML5 parser, WHATWG 準拠、push callback API)
- **Chagashi** (char encoding decoder)
- **QuickJS-NG** (JS、default disabled)
- **自作**: CSS parser、cascade、box tree、layout、renderer、URL parser、DOM、fetch driver 全て

→ HTML parsing と char decoding だけ外注、**CSS 以降は全部自前**。

### 1.4 非自明な big picture decisions

- **`FlexibleGrid = seq[FlexibleLine]`**（line = string + sparse format 配列）を layout 中間表現にする。2D 配列でなく line 可変長。**検索が正規表現 1 発で走る**。メモリ線形。
- **Incremental layout**: `CSSBox.keepLayout: bool` + `LayoutInput` 比較で subtree skip
- **network cache なし**: source を disk に書いて再読み込み（w3m 流）
- **terminal probing ベース**: termcap/ncurses 不使用、terminal query で機能判定

---

## 2. Pipeline stages

### 2.1 HTML parsing (Chame)

Push API で DOM tree を構築。`ChaDOMBuilder` が callback を実装:

- `createElementForTokenImpl`, `insertTextImpl`, `insertCommentImpl`
- `elementPoppedImpl` — 閉じタグ時の副作用（script 実行、stylesheet 取得）
- `setEncodingImpl` — charset 確度付き再設定

DOM node shape (`src/html/dom.nim`):

```nim
type
  Element = ref object of Node
    tagType: TagType
    attrs: seq[AttrData]
    computed: CSSValues   # ← style cascade 結果をここに直接生やす
    invalid: bool         # dirty flag
```

**非自明**: `CAtom` (interned atom) で tag/attr を uint32 化。比較が integer。

### 2.2 CSS parse & cascade

Rule indexing (`src/css/sheet.nim`): selector の rightmost key で hash table 分配。

```nim
type CSSRuleMap = object
  idTable: Table[CAtom, seq[CSSRuleDef]]
  tagTable: Table[CAtom, seq[CSSRuleDef]]
  classTable: Table[CAtom, seq[CSSRuleDef]]
  attrTable: Table[CAtom, seq[CSSRuleDef]]
  rootList, hintList, generalList: seq[CSSRuleDef]
```

`element.matches` は該当 bucket だけ走査。Bloom filter は無し。

Selector matching: 右から左 (`cxsel.ritems`)。`:hover :focus :checked :target` は `DependencyInfo` にマーク。

Cascade order: UA(!) → User(!) → Author(!) → Author → User → UA。specificity 事前計算、tie は rule.idx。

**Computed value は Element.computed に直接生やす**（別 styled tree を作らない）。

### 2.3 Box tree construction (`src/css/csstree.nim`)

```nim
proc buildTree*(element: Element; cached: CSSBox; markLinks: bool;
                nhints: int; linkHintChars: ref seq[uint32])
```

アルゴリズム:

1. `build()` が再帰的に styled node を訪問
2. `getParent()` が display 値から anonymous wrapper を挿入:
   - `DisplayInnerTable` → `DisplayTableWrapper` + table 2 段構造（caption = outer、row = inner）
   - `DisplayFlex`/`Grid` → 非適合 child を anonymous block でラップ
   - `DisplayListItem` → `::marker` pseudo 挿入
3. `addPseudo()` で `::before`/`::after`/`::marker`/`::-cha-link-hint`
4. **cache 再利用**: `matchCache()` / `takeCache()` で box を使い回し

**重要 invariant**: tree 構造 mutation は **この pass でしか起きない**。layout pass は read-only。これが cache の前提。

Box 型階層 (`src/css/box.nim`):

```nim
CSSBox (基底: parent/firstChild/next, computed, element, keepLayout, render)
├── BlockBox (+ input: LayoutInput, state: BoxLayoutState)
├── InlineBox (+ state: InlineBoxState)
│   ├── InlineTextBox (+ runs, text, len)
│   └── InlineNewLineBox
```

`BoxLayoutState`: offset/size/intrinsic、`marginTodo`、`exclusionsHead/Tail`（float 除外領域 linked list）、`pendingFloatsHead/Tail`、baseline、`clearOffset`。

### 2.4 Layout engine (`src/css/layout.nim` — 3168 行)

**中央 dispatch**:

```nim
proc layout(lctx, box, offset, input, forceRoot) =
  case box.computed{"display"}
  of DisplayFlowRoot, DisplayTableCaption, DisplayInlineBlock, ...:
    lctx.layoutFlowRoot(box, offset, input)
  of DisplayBlock, DisplayListItem:
    # BFC が必要なら layoutFlowRoot、通常は layoutFlowDescendant
  of DisplayTableCell: lctx.layoutFlow(box, input, root = true)
  of DisplayInnerTable: lctx.layoutTable(box, offset, input)
  of DisplayInnerFlex: lctx.layoutFlex(box, offset, input)
  of DisplayImageBlock, DisplayImageInline: lctx.layoutImage(box, offset, input)
```

#### BFC (block formatting context)

`FlowState` に bfcOffset/exclusions/pendingFloats/marginTodo を持つ。margin collapsing は遅延処理（最初に margin を resolve する child が決まってから float を配置）。

#### IFC (inline formatting context)

`LineBoxState`（atomsHead/Tail の双方向 linked list、nowrapHead/Tail、baseline、size）。

走査パイプ:

1. `layoutText` → `layoutTextLoop` (char-by-char)
2. `checkWrap`: CJK (width=2) は毎文字折り返し候補、Latin は space/hyphen
3. `prepareSpace` / `finishLine` / `alignLine`
4. `positionAtom` で `vertical-align` 別に垂直整列

```nim
case atom.vertalign
of VerticalAlignBaseline: atom.offset.y = lbstate.baseline - atom.offset.y
of VerticalAlignMiddle:   atom.offset.y = lbstate.baseline - atom.size.h div 2
of VerticalAlignTop:      atom.offset.y = 0
of VerticalAlignBottom:   atom.offset.y = lbstate.size.h - atom.size.h
```

#### Flexbox (`layoutFlex`)

**CSS Flexible Box Module §9.7 Resolving Flexible Lengths** をほぼ直訳。

```nim
type
  FlexPendingItem = object
    child: BlockBox
    weights: array[FlexWeightType, float32]   # [grow, shrink]
    input: LayoutInput
  FlexMainContext = object  # 1 line 分
    totalSize, maxSize, shrinkSize
    totalWeight: array[FlexWeightType, float32]
    pending: seq[FlexPendingItem]
```

アルゴリズム:

1. `flex-direction` から main dim 決定
2. 各 child に `resolveFlexItemSizes` → `layoutFlexItem` で仮 layout
3. wrap しきい値で `flushMain`
4. `redistributeMainSize`: `diff = available - totalSize`、**violation-freeze**
   - `unit = diff / totalWeight`
   - item に `unit * weight` 配分、min/max 違反は freeze して weight 0 化
   - freeze 分を diff から引いて loop 継続
5. cross axis: stretch、auto margin、baseline
6. `reverse` flag で offset 反転

#### Table layout (4 pass)

- `preLayoutTableColspan` — colspan 考慮 width 配分
- `preLayoutTableRows` — 各 cell の min/max/specified width 集計
- `calcSpecifiedRatio` — percentage column 分配
- 各 cell を実サイズで re-layout

cyclic dependency は `keepLayout` cache で quadratic blowup 回避。

#### Floats

- `exclusions: Exclusion` linked list に (offset, size, t:left|right) 追加
- `findNextFloatOffset` は QEmacs 由来: y を下げながら exclusion 交差しない x 範囲を探す
- `clearFloats` で `clear: left|right|both`

#### Positioning

- **absolute/fixed は deferred**: `popPositioned` で親 size 確定後に位置決定
- **fixed は document 末尾配置**（viewport 固定でなく、overlapping を避ける）
- **sticky は static フォールバック**

#### keepLayout caching

```nim
if box.keepLayout and box.input == input:
  box.state.offset = offset   # 位置だけ更新
  return                       # subtree layout skip
box.input = input
box.keepLayout = true
box.resetState()
```

### 2.5 Inline layout — TUI 固有

- `1em` = cell height、`1ch` = cell width
- `border-width` は **binary**（あり/なし）、cell 未満は margin 吸収
- margin/padding の cell rounding (`roundSmallMarginsAndPadding`)
- Text decoration は 7 flag (`FormatFlag`: bold/italic/underline/reverse/strike/overline/blink)、text run 単位で保存

### 2.6 Painting (`src/css/render.nim`)

**Grid 表現**:

```nim
type
  Format = object
    u: uint64           # bg 26 + fg 26 + flags 12 bits, 1 word packed
  SimpleFormatCell = object
    format: Format
    pos: int            # byte index
  SimpleFlexibleLine = object
    str: string
    formats: seq[SimpleFormatCell]  # sparse
  SimpleFlexibleGrid = seq[SimpleFlexibleLine]
```

**z-ordering**:

```
1. 負 z-index の子
2. 自分
3. 非負 z-index の子
```

`StackItem` tree。float も stacking context を作る（spec 外動作）。

**CJK 幅**: `findFirstX` / `setText0` で codepoint 進行、target position 超過時は直前 double-width cell を space 2 つに潰す。

**Border 描画**: Box Drawing Unicode (`┌` 等) + junction 判定 enum 化。

### 2.7 Image rendering

- **Sixel** (`term.nim`): raster attrs → crop offset → partial row masking を自前計算
- **Kitty**: APC escape + base64 データを 4KB チャンクで `m=1` continuation 送信
- inline image は `layoutImage` で box サイズ確定、`images: seq[PosBitmap]` に位置+bitmap 追加
- terminal 出力時に対応 cell へ escape 埋め込み

### 2.8 Incremental & reflow

- **scroll は reflow しない**: `fromy`/`fromx` 変更 + `scrollUp`/`scrollDown` escape で差分出力
- **resize のみ full re-layout**（ただし `keepLayout` で subtree skip 多数）
- **差分 frame 出力** (`term.nim:writeGrid`): `canvas` に前 frame 保持、cell 単位 diff、line 単位 `lineDamage` フラグ

---

## 3. Data structures（aispy TS 写像）

| Chawan | TS 相当 |
|--------|---------|
| `CSSBox` / `BlockBox` / `InlineBox` / `InlineTextBox` | discriminated union `type Box = BlockBox \| InlineBox \| InlineTextBox \| InlineNewLineBox` |
| `LayoutInput` (space, bounds, margin, padding, border) | `interface LayoutInput`、deep-equal で cache key |
| `BoxLayoutState` | `interface BoxLayoutState` |
| `LineBoxState` | `class LineBoxState`（mutable state） |
| `FlexibleGrid = seq[FlexibleLine]` | `type FlexibleGrid = FlexibleLine[]`, `interface FlexibleLine { str, formats }` |
| `Format` (uint64 packed) | `interface Format { fg, bg, flags }`（uint64 packing 不要） |
| `Exclusion` (linked list) | 配列で十分 |
| `StackItem` | `interface StackItem { negChildren, posChildren, box }` |

**Link/hitbox**: Chawan は `FlexibleLine.formats[i].node: Element` として sparse に持つ。`getCursorElement(x, y)` は `lines[y].findFormatN(x) - 1` で格納位置を引き `.node` を返す。別 hitbox 配列なし — **cell grid 自体が source of truth**。aispy も同設計。

---

## 4. Interactive concerns（Phase 4/5 用）

### Link hint mode

`csstree.nim` の `buildTree` に `nhints`, `linkHintChars` 引数。anchor 相当 element に `::-cha-link-hint` pseudo を付け、layout pass が普通に inline box として hint 文字を埋め込む。`bcShowHints`/`bcHideHints` メッセージで element の `hint` flag を立てて `maybeReshape`。

cursor-based navigation も併存: `cursorNextLink` / `cursorPrevLink`。

### Form input

`click(HTMLInputElement)` → `ClickResult(t: crtReadText, prompt, value)`。pager 側で **modal line editor** (`lineedit.nim`)、確定で `bcReadSuccess`。**inline 編集でなく modal**。

### Scroll

**offset のみ**、layout 触らない。resize 時だけ full re-layout。

### Tabs / history

- **tab 無し**（single active buffer）
- `lineHist[lmLocation]` で URL history、disk 永続化
- 明示的 back/forward 無し（URL 直指定）

aispy は tab bar ありの browser UI を採用する前提で差別化。

### Keybinding

JS で dispatch (`init.js` 94KB)、chord を trie で処理。aispy は Ink `useInput` で自然。

---

## 5. 苦労箇所（Chawan 側の lessons）

1. **Anonymous box 生成** — table outer/inner、block-in-inline 分割
2. **Margin collapsing** — float との相互作用で遅延処理必要
3. **Flex violation-freeze loop** — frozen item 処理ミスると O(N²)
4. **CSS cyclic dependency** — table column width / flex cross size で `keepLayout` cache 必須
5. **Terminal probing** — termcap 捨てた代わりに query 応答待ち処理
6. **macOS 対応不足** — 1人開発の限界

### 既知の非対応

- `font-size`: ignored（cell size 固定）
- `background-image`: placeholder のみ
- `flex-basis: content`: 未対応
- `:visited`: parse するが match しない
- Custom elements / Shadow DOM: 未対応
- `position: fixed`: document bottom 配置（viewport 固定でない）
- `position: sticky`: static フォールバック
- Scrollbar 無し

---

## 6. aispy TS 再実装の推奨

### 6.1 採用順序（impact × effort 順）

1. **Box tree 正規化層** — `src/core/boxTree.ts` 新規。cssResolver 結果を `CSSBox` に載せる中間 layer。**全拡張の前提**
2. **Inline Formatting Context 本格実装** — `LineBoxState` + baseline + vertical-align + inline-block 混在。reader 体験に直結
3. **Table layout** — 4-pass アルゴリズム port (~500 行)
4. **Floats** — Exclusion list + `findNextFloatOffset` (~200-300 行)
5. **keepLayout caching** — 正確性が揃ってから最適化として
6. **Flexbox violation-freeze loop** 強化（現 flexLayout.ts 次第）

### 6.2 TS 固有の注意

- **Packed uint64 Format は真似ない**: bigint は遅い。普通の `{fg, bg, flags}` で V8 hidden class 効く
- **Intrusive linked list も真似ない**: TS は array で十分
- **discriminated union は TS が強い**: switch with exhaustive check
- **iterator 移植**: ホットパスでは array 返す方が速い
- **atom interning**: 優先度低、必要なら後
- **deep equal for LayoutInput cache**: hand-written comparator か immer で reference equality

### 6.3 ライブラリ選定

- **HTML parser**: jsdom は重い。**layout 用は parse5 + 自前 DOM wrapper**、readability 用に jsdom を残す hybrid
- **CSS parser**: css-tree 維持
- **Cascade**: 自前（Chawan cascade.nim + sheet.nim ~800 行を直訳）
- **Flexbox**: **yoga-layout 採用しない**（wasm 依存、integration 詰む）。Chawan port が最速
- **CJK 幅**: 既存 `east-asian-width` / `string-width` 系
- **ANSI 出力**: Ink に任せる
- **Atom interning**: 不要

### 6.4 移植しない

| 機能 | 理由 |
|---|---|
| QuickJS JS engine | Phase 7+ |
| Multi-process / forkserver | Node async/await で十分 |
| XHR / fetch API in sandbox | aispy fetch cache で代替 |
| Gopher/Gemini/FTP | HTTP only で十分 |
| Sandboxing (seccomp/pledge) | OS 機能、TS 範囲外 |
| `position: fixed/sticky` 完全模倣 | Chawan でも半壊、TUI で意味薄 |

### 6.5 Image rendering は移植する（Phase 3.7、user 判断）

Chawan 内では割愛カテゴリだったが、aispy では **高精細 TUI ブラウザとしての差別化軸** のため採用。詳細は spec §6 Phase 3.7。

---

## 主な参照ファイル

- `doc/architecture.md` — プロセスモデル、パイプライン、incremental layout
- `doc/css.md` — 対応 CSS 機能、TUI 固有 quirk
- `src/css/layout.nim` (3168 行) — layout engine
  - line 3093: 中央 dispatch
  - line 2861-3090: flex 本体 (`redistributeMainSize`, `flushMain`)
  - line 1500-1800: table
  - line 1180-1280: inline / text
  - line 850-900: float
- `src/css/csstree.nim` — Box tree 構築
- `src/css/box.nim` — Box 型階層
- `src/css/render.nim` — cell grid 生成、stacking、border
- `src/css/cascade.nim` — cascade + inheritance
- `src/css/sheet.nim` — rule indexing
- `src/css/match.nim` — selector matching
- `src/types/cell.nim` — `FlexibleGrid` / `Format`
- `src/local/term.nim` — terminal 出力、frame diff、Sixel/Kitty escape

## Sources

- [sourcehut-mirrors/chawan](https://github.com/sourcehut-mirrors/chawan)
- [Chawan architecture](https://github.com/sourcehut-mirrors/chawan/blob/master/doc/architecture.md)
- [Chawan CSS doc](https://github.com/sourcehut-mirrors/chawan/blob/master/doc/css.md)
- [Chame HTML parser](https://git.sr.ht/~bptato/chame)
- [Chagashi encoding lib](https://git.sr.ht/~bptato/chagashi)
- [Chawan HN discussion](https://news.ycombinator.com/item?id=44293260)
- [chawan.net](https://chawan.net/)
