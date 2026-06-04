# 設計書: Storybook QueryClientProvider 追加 (#107)

## 1. 目的 / 背景

`docs/.storybook/preview.tsx` の `decorators` は `ThemeProvider` + `CssBaseline` のみで story をラップしており、`QueryClientProvider` が存在しない。TanStack Query（`useQuery` / `useMutation` / `useQueryClient`）を使うコンポーネント（`ChannelList`、`AccountScene` 等）の Storybook 上の表示時に「No QueryClient set, use QueryClientProvider to set one」というランタイムエラーが発生する。

## 2. スコープ（やること / やらないこと）

**やること**
- `docs/.storybook/preview.tsx` に `QueryClientProvider` decorator を追加し、全ストーリーが QueryClient を参照できるようにする
- `@tanstack/react-query` を `docs/devDependencies` に追加する
- `createQueryClient()` を `@hatchery/client/queryClient` から再利用する（テスト・本体と設定を共有）

**やらないこと**
- ストーリーごとの API レスポンスモック整備（MSW 導入・個別ストーリーのモック設定）
- 既存 ThemeProvider decorator の変更（追加のみ）

## 3. 受け入れ条件（テストに落とせる粒度）

- `docs/.storybook/preview.tsx` の `decorators` に `QueryClientProvider` decorator が追加され、decorators の長さが 2 以上になる
- `ChannelList` ストーリー・`AccountScene` ストーリーが「No QueryClient set」エラーなく表示できる（Storybook ビルド成功で確認）
- `turbo run lint`（docs ワークスペースの lint）が緑

## 4. 設計方針

### Decorator の分割構成

既存の ThemeProvider decorator を変更せず、**新たに QueryClientProvider decorator を追加**する。

```
decorators: [QueryClientProviderDecorator, ThemeDecorator]
```

Storybook はデコレータを配列の先頭から適用する（先頭 = 最外側）。
上記の順序で以下のネストになる:
```
<QueryClientProvider>        ← decorators[0]
  <ThemeProvider>            ← decorators[1]
    <CssBaseline />
    <Story />
  </ThemeProvider>
</QueryClientProvider>
```

### createQueryClient() の再利用

Issue 要件通り `@hatchery/client/queryClient` の `createQueryClient()` を使用する。`docs/.storybook/main.cts` の Vite alias `@hatchery/client` → `../../client/src` によりビルド時に解決される。

### @tanstack/react-query の docs への追加

`docs/package.json` の `devDependencies` に `@tanstack/react-query: "^5.62.7"` を追加する。Storybook ビルド（Vite）の実行時、`preview.tsx` から直接インポートするため、`docs` パッケージの直接依存として宣言する。

## 5. 影響範囲

- `docs/.storybook/preview.tsx` — decorator 追加
- `docs/package.json` — devDependencies に `@tanstack/react-query` 追加
- `pnpm-lock.yaml` — lockfile 更新（新規 deps なし、再利用）

## 6. テスト計画

`docs/src/storybook-preview.test.ts` に以下のテストケースを追加する（TDD: 先に書いて失敗確認後、実装で緑にする）:

- `decorators が 2 つ以上定義されている（QueryClientProvider decorator を含む）`: `preview.decorators!.length` が `>= 2` であること

## 7. リスク・未決事項

- `@tanstack/react-query` は `client/node_modules` には存在するが `docs/node_modules` には存在しない。`docs/package.json` に追加・`pnpm install` で解決する。
- Storybook ビルドの実行はこの環境（Node v22 / engine-strict=true）では難しいため、Vitest テストと lint のみで検証する。
