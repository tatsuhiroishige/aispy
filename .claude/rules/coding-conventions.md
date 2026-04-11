# Coding 規約

TypeScript + Ink + MCP SDK の組み合わせで書く aispy の code 規約。`google-gemini/gemini-cli`、`vadimdemedes/ink`、`modelcontextprotocol/typescript-sdk` の実装を参考にしている。

## プロジェクトレイアウト

単一 package、`src/` root。monorepo 不要。

```
aispy/
├── src/
│   ├── index.ts              # bin entry (shebang 付き、MCP server + TUI を wire)
│   ├── mcp-server.ts         # MCP server entry (stdio)
│   ├── tui.tsx               # Ink TUI entry (render(<App/>))
│   ├── mcp/
│   │   ├── server.ts
│   │   ├── tools/
│   │   │   ├── search.ts
│   │   │   └── fetch.ts
│   │   └── types.ts
│   ├── ui/
│   │   ├── App.tsx
│   │   ├── components/       # PascalCase.tsx
│   │   ├── hooks/            # useFoo.ts
│   │   ├── contexts/         # FooContext.tsx
│   │   └── types.ts
│   ├── core/                 # domain logic: store, htmlToText, browserOpen 等
│   └── types.ts              # cross-cutting shared types
├── tests/                    # integration tests のみ (unit test は colocated)
├── package.json
├── tsconfig.json
└── eslint.config.js
```

Unit test は source と colocate (`Foo.test.tsx` を `Foo.tsx` の隣)、integration test のみ `tests/` 下に置く。

## Entry point

- `src/mcp-server.ts`: MCP server を stdio で起動する関数を export
- `src/tui.tsx`: Ink の `render(<App/>)` を呼ぶ関数を export
- `src/index.ts`: bin script。shebang `#!/usr/bin/env node` を付け、起動時に両方を wire する

`package.json`:

```json
{
  "type": "module",
  "bin": { "aispy": "dist/index.js" }
}
```

## 命名

| 種類         | 命名                         | 例                                    |
|--------------|------------------------------|---------------------------------------|
| Component    | `PascalCase.tsx`             | `ActivityLog.tsx`, `PageViewer.tsx`   |
| Hook         | `useFoo.ts`                  | `useKeyboard.ts`, `useStore.ts`       |
| Context      | `FooContext.tsx`             | `StreamingContext.tsx`                |
| 一般 module  | `camelCase.ts`               | `htmlToText.ts`, `browserOpen.ts`     |
| Test         | `Foo.test.ts(x)` (colocated) | `ActivityLog.test.tsx`                |
| 型ファイル   | `types.ts` (小文字)          | `src/types.ts`, `src/ui/types.ts`     |

- Kebab-case は使わない。
- 1 ファイル 1 component / 1 hook。複数を 1 ファイルに詰めない。
- Barrel file (`index.ts` の re-export) は entry point 以外では作らない。

## TypeScript

### `tsconfig.json` (strict 最大化)

```jsonc
{
  "compilerOptions": {
    "strict": true,
    "noUnusedLocals": true,
    "noImplicitOverride": true,
    "noImplicitReturns": true,
    "noPropertyAccessFromIndexSignature": true,
    "verbatimModuleSyntax": true,
    "forceConsistentCasingInFileNames": true,
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "target": "es2022",
    "jsx": "react-jsx",
    "outDir": "dist",
    "rootDir": "src",
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*"]
}
```

### Import 規約

- Relative import は必ず `.js` 拡張子（NodeNext の要件、TypeScript source でも `.js` で書く）
  - ✓ `import { foo } from './utils.js'`
  - ✗ `import { foo } from './utils'`
- 型のみの import は `import type`
  - ✓ `import type { Tool } from '@modelcontextprotocol/sdk/types.js'`
- `verbatimModuleSyntax` 有効なので type と value を混ぜた import はエラー。分ける。

### Type declaration

- **Public contract**（function props, exported shape, React component props）: `interface`
- **Union, alias, discriminated union**: `type`
- 型は使用箇所の近くに置く。
- **横断的な型のみ** `src/types.ts` に置いて re-export する。
- Global な `types/` dir は作らない。
- React component props は同じファイルで `interface FooProps` と定義する。

## State management

### 方針

- 外部 store（zustand, redux, jotai, recoil）は使わない。
- `useState` + `useRef` + `useEffect` と React Context のみ。

### 非同期 stream を component に流す pattern

```tsx
function ActivityLog() {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const bufferRef = useRef<LogEntry[]>([]);

  useEffect(() => {
    const unsubscribe = store.subscribe((entry) => {
      bufferRef.current = [...bufferRef.current, entry];
      setEntries(bufferRef.current);
    });
    return unsubscribe;
  }, []);

  return <Box flexDirection="column">{/* ... */}</Box>;
}
```

- Buffer は `useRef`（再 render を発生させない）
- Render 向け state は `useState`
- Subscribe は `useEffect` の mount 時に 1 回
- Cleanup で unsubscribe

### Context

- Cross-component state は React Context で共有する。
- Re-render 圧が増えたら `FooContext`（read）と `FooActionsContext`（write）に分離する。

## Tooling

| 種類   | ツール                  |
|--------|-------------------------|
| Test   | Vitest                  |
| Lint   | ESLint (flat config)    |
| Format | Prettier                |
| Dev    | tsx watch               |
| Build  | tsc                     |

### `package.json` scripts

```json
{
  "scripts": {
    "build": "tsc",
    "dev": "tsx watch src/index.ts",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "eslint .",
    "format": "prettier --write ."
  }
}
```

## Comment policy

- Default は no comment。
- Hook / exported module / MCP tool の宣言上の 1 行 JSDoc は OK。
- File-level license header は書かない。
- **書いてはいけない comment**:
  - 歴史（`// 追加`, `// 修正`, `// fixed bug #42`）
  - 何をしているか（`// fetch page content` — 関数名で伝える）
  - 当事者向けメモ（`// この関数は X の flow で使われる`）
- **書いていい comment**:
  - 非自明な invariant（`// index is guaranteed non-negative by upstream validation`）
  - Workaround（`// Ink 5.x bug: setState in raw mode drops input, retain ref`）
  - Hidden constraint（`// max 8 results — Brave free tier limit`）
