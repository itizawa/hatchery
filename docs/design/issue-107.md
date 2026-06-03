# 設計書: Storybook で QueryClient 未設定エラーを解消する (#107)

## 1. 目的 / 背景

`docs`（Storybook）でストーリーを表示すると、TanStack Query を内部で呼ぶコンポーネントが
`No QueryClient set, use QueryClientProvider to set one` エラーでクラッシュする。

`docs/.storybook/preview.tsx` の global decorator が `ThemeProvider` + `CssBaseline` のみで
`QueryClientProvider` を含まないことが原因。

## 2. スコープ（やること / やらないこと）

**やること**

- `docs/.storybook/preview.tsx` の global decorator に `QueryClientProvider` を追加する
- `client/src/queryClient.ts` の `createQueryClient()` を再利用して QueryClient を生成する
- 全ストーリーが QueryClient エラーなく表示されるようにする
- `docs/package.json` に `@tanstack/react-query` を追加する（`QueryClientProvider` の型解決に必要）

**やらないこと**

- MSW によるAPIレスポンスモック（別 Issue スコープ）
- 既存の `ThemeProvider` decorator の挙動変更

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

- `docs/.storybook/preview.tsx` の `decorators` に `QueryClientProvider` が含まれる
- `QueryClientProvider` のラップ順序は `QueryClientProvider > ThemeProvider > CssBaseline > Story`
- `createQueryClient()` を `@hatchery/client/queryClient` から import して QueryClient を生成する
- `docs/package.json` に `@tanstack/react-query` が追加される
- `turbo run lint`（または `pnpm --filter @hatchery/docs lint`）が緑

## 4. 設計方針

### QueryClient の生成方法

`client/src/queryClient.ts` の `createQueryClient()` を使用。
Storybook の Vite エイリアスが `@hatchery/client` → `../../client/src` と設定されているため、
`preview.tsx` から `import { createQueryClient } from "@hatchery/client/queryClient"` で取得できる。

生成済みファイル（`openapi.gen.ts`）には依存しない純粋な TypeScript モジュールなので問題なし。

### QueryClient インスタンスのライフサイクル

Storybook のグローバル decorator は一度だけ評価されるため、モジュールレベルで
`const queryClient = createQueryClient()` と定義する。
ストーリー間でキャッシュが混在しても（現時点では MSW モックなし）エラーはクラッシュから
「データ取得失敗」に変わるだけで許容範囲内（Issue スコープ）。

### Provider のネスト順序

```
<QueryClientProvider client={queryClient}>
  <ThemeProvider theme={previewTheme}>
    <CssBaseline />
    <Story />
  </ThemeProvider>
</QueryClientProvider>
```

QueryClientProvider は最外層に配置することで ThemeProvider の children から利用できる。

### `docs/package.json` への依存追加

`preview.tsx` は `QueryClientProvider` の型を `@tanstack/react-query` から解決する。
`@hatchery/client` が workspace dep として既に含まれているが、
lint / TypeScript の型解決のため `docs` でも直接宣言する。

## 5. 影響範囲 / 既存への変更

- `docs/.storybook/preview.tsx` — `QueryClientProvider` decorator 追加
- `docs/package.json` — `@tanstack/react-query` を dependencies に追加

## 6. テスト計画（TDD で書くテスト一覧）

Storybook の decorator は UI ランタイムの設定ファイルであるため、Vitest による単体テストより
「lint 緑 + 型チェック緑」で受け入れ条件を満たすことを確認する。

- `pnpm --filter @hatchery/docs lint` — ESLint 緑
- `pnpm typecheck` — TypeScript strict 型チェック緑

## 7. リスク・未決事項

- 現時点では MSW がないため、ストーリー表示時に API コールは失敗するが、QueryClient エラーでクラッシュはしない
- `pnpm install` 後に `@tanstack/react-query` が `docs` の node_modules に追加されるが、
  ロックファイルの変更が生じる点に注意（CI で frozen-lockfile を使う場合は pnpm install が必要）
