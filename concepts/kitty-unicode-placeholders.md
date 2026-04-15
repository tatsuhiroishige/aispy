# Kitty Unicode Placeholders — aispy mapping note

Phase 3.7 の inline 画像配置を FlexibleGrid 抽象と自然に同居させるための design note。

## 1. Protocol 要旨

Kitty graphics protocol の "Unicode placeholders" mode（Kitty / Ghostty / WezTerm 対応）:

1. **Virtual image upload** — 画像データを APC で送るが **描画はしない**。
   ```
   ESC_G a=T,f=32,s=W,v=H,i=ID,U=1,q=2,m=<0|1>;<base64-chunk>ESC\
   ```
   - `U=1` で "Unicode placeholder mode" を指示
   - `q=2` で terminal からの応答を抑制
   - `i=ID` は 24-bit image ID（1 以上）
   - 画像は terminal 内に保持されるがカーソル位置を消費しない

2. **Placeholder cell** — 通常のテキストとして grid に書く。各 cell は:
   - **Base char**: `U+10EEEE` (placeholder codepoint、幅 1)
   - **Combining 1**: row diacritic (0-indexed、`DIACRITICS[row]`)
   - **Combining 2**: col diacritic (0-indexed、`DIACRITICS[col]`)
   - **fg color**: 24-bit truecolor で image ID を encode (`\e[38;2;R;G;B m` で R<<16 | G<<8 | B = ID)

3. **Terminal が自動で描画** — placeholder codepoint を見つけた terminal が、fg color で示される ID の画像を lookup し、指定 row/col のタイルを cell に描画。

## 2. aispy の既存構造との mapping

| aispy concept | Placeholder での実装 |
|---|---|
| FlexibleGrid cell | `U+10EEEE` + 2 combining (= 幅 1 codepoint 列) |
| 画像の (x, y, w, h) | w×h 個の placeholder cell を grid に setText |
| Image ID | ansiSerializer が Format.fgTrueColor で encode |
| Terminal への送信順 | serializer 先頭で全 image の virtual upload → grid の placeholder テキスト |

## 3. 必要な変更点

### 3.1 FlexibleGrid (`flexibleGrid.ts`)

- `charWidth` が combining mark を **width 0** として扱うよう拡張。現状は `code < 0x20 → 0, CJK → 2, それ以外 → 1` だけ。
- `Format` に `fgTrueColor?: number`（packed 0xRRGGBB）を追加。Format 比較で fg/bg/flags に加えてこれも見る。

### 3.2 ANSI serializer (`ansiSerializer.ts`)

- `fgSeq` が `fgTrueColor` 優先で truecolor escape を吐く。
- `serializeGrid` が grid の前に virtual-upload APC 群を prepend（重複 ID は除外）。

### 3.3 Image protocol (`imageProtocol.ts`)

- `encodeKittyVirtualUpload(img, id)`: `a=T, U=1, q=2` 付きの APC chunked。
- `encodeKittyPlaceholder(id, row, col)`: `U+10EEEE + rowDiacritic + colDiacritic` の文字列を返す（color は Format 側で制御）。
- 既存 `encodeKitty` は iTerm2 OSC 1337 との対称性のため残す（fallback path）。

### 3.4 Paint (`paint.ts`)

- `paintImage` を書き換え: decode 済み画像の (w, h) cell 数を layout から取得、各 cell に placeholder codepoint を setText、Format.fgTrueColor = image ID。
- Gallery mode (`appendImageGallery`) を削除。

### 3.5 Image store (`imageStore.ts`)

- `ImageBox → uniqueId` の Map を追加。id allocation は `imageProtocol` の counter を流用。
- Serializer が必要とする `(id, decodedImage)` の pair を iterate できる API を export。

## 4. Row/Col diacritics

Kitty 公式の diacritic 表（[rowcolumn-diacritics.txt](https://sw.kovidgoyal.net/kitty/_downloads/f0a0de9ec8d9ff4456206db8e0814937/rowcolumn-diacritics.txt)）から先頭部分を取り込む。aispy の MAX_IMAGE_CELLS_WIDTH = 40 / HEIGHT = 20 なので index 0–39 あれば足りる:

```
0x0305, 0x030D, 0x030E, 0x0310, 0x0312, 0x033D, 0x033E, 0x033F,
0x0346, 0x034A, 0x034B, 0x034C, 0x0350, 0x0351, 0x0352, 0x0357,
0x035B, 0x0363, 0x0364, 0x0365, 0x0366, 0x0367, 0x0368, 0x0369,
0x036A, 0x036B, 0x036C, 0x036D, 0x036E, 0x036F,
0x0483, 0x0484, 0x0485, 0x0486, 0x0487,
0x0592, 0x0593, 0x0594, 0x0595, 0x0597,
...
```

将来 index ≥ 40 が必要になったら full table を取り込む。

## 5. 非対応 / 後続 phase

- **iTerm2**: 既存の `encodeITerm2` (OSC 1337) を維持。Unicode Placeholders は非対応 terminal。
- **Sixel**: 既存通り未対応。
- **Block-in-inline split**: `<a><img></a>` の IFC 経路整理は本 phase の範囲外。Inline image atom の位置制御は別 issue。

## 6. Test 戦略

- `imageProtocol.test.ts`: virtual upload encoder + placeholder encoder のユニットテスト
- `flexibleGrid.test.ts`: combining mark 幅 0 を確認（placeholder string の displayWidth = 1）
- `paint.test.ts`: image box が placeholder cell 矩形として書き込まれることを確認
- `ansiSerializer.test.ts`: truecolor fg が正しく emit される + 先頭で virtual upload が出ること
- 実 render: `npm run test-image -- <url>` を Ghostty で実行して目視確認（30 min session 内では困難なので手動確認は user に依頼）

## 7. 参照

- [Kitty graphics protocol — Unicode placeholders](https://sw.kovidgoyal.net/kitty/graphics-protocol/#unicode-placeholders)
- [rowcolumn-diacritics.txt](https://sw.kovidgoyal.net/kitty/_downloads/f0a0de9ec8d9ff4456206db8e0814937/rowcolumn-diacritics.txt)
- `concepts/status-2026-04-15.md` §3.3 — 旧 `C=1` 経路の制約
