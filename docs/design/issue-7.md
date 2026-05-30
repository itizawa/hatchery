# 設計書: Setup: client スタック（Vite + React 19 / MUI / TanStack Router・Query） (#7)

## 1. 目的 / 背景

ADR-0003（client スタック）に従い、SPA フロントエンドの土台を `client/` に実装する。
Vite + React 19（SSR なし）/ MUI v6 + Emotion（Slack 風テーマ）/ TanStack Router / TanStack Query。
サーバ状態は TanStack Query に集約し、グローバル状態管理ライブラリは当面入れない。

現状 `client/` は #4 で作られた純粋 TS の placeholder（`src/index.ts` が `@hatchery/common` の
`add` を再利用する雛形）。本 Issue でこれを実 SPA に差し替える。

### 付随する前提（develop の修復）

#5 で `common` の placeholder `add` が実ドメイン API（`DEFAULT_CHANNELS` 等）へ置き換わった結果、
旧 `add` を参照する placeholder（client / server / docs）が壊れ、develop の CI（`turbo run lint test build`）は
red のままになっている。CI は全ワークスペース横断で走るため、#7 を CI 緑でマージするには
client 以外の破損も解消する必要がある。最小修復として:

- **client**: 本 Issue の対象。SPA 本体へ差し替え。barrel `src/index.ts` は docs（#9）の placeholder が
  参照する `total` を**純粋関数として維持**し、React を barrel に持ち込まない（docs の node 実行時に React を読み込ませない）。
- **server**: `src/index.ts` の `add` 参照を実 common API（`DEFAULT_CHANNELS`）へ 1 ファイル最小修復。
  既存テスト（`sum(2,3)===5`）は維持。実体は #6 で差し替えられる前提。
- **docs**: client が `total` を維持するため**無改修**。

## 2. スコープ（やること / やらないこと）

### やること

- Vite + React 19 SPA の土台（`index.html` / `main.tsx` / `vite build` / `vite` dev）
- MUI v6 + Emotion による Slack 風テーマ（`ThemeProvider` + `CssBaseline`）の土台
- TanStack Router（**コードベース定義**。ファイルルーティングの codegen は使わない）で最小ルート
  （ホーム＝シーン表示の枠 / チャンネル別ビューの枠）を定義
- TanStack Query の `QueryClient` と `QueryClientProvider` 設定（サーバ状態は Query に集約する方針を雛形で表現）
- `@hatchery/common` への実依存（`DEFAULT_CHANNELS` を描画）。`@hatchery/server` には依存しない（#4 の ESLint import 制約で担保）
- Vitest + React Testing Library による最小コンポーネントテスト
- server placeholder の最小修復（CI 緑化のため）

### やらないこと

- openapi-typescript / openapi-fetch による型安全 API 呼び出し（#8）
- 画面の本実装（MVP 機能 Issue）
- Storybook 連携（#9）
- 実 API 通信（モック含め行わない。Provider の配線まで）

## 3. 受け入れ条件（テストに落とせる粒度）

1. **テーマ**: `slackTheme` は MUI テーマで、`palette.mode==="dark"`、Slack 風のサイドバー背景色など
   規定のパレット値を持つ（`theme.test.ts`）。
2. **チャンネル一覧**: `ChannelList` は `@hatchery/common` の `DEFAULT_CHANNELS`（`zatsudan` / `shigoto`）を
   すべて描画する（client→common の実依存。`ChannelList.test.tsx`）。
3. **QueryClient**: `createQueryClient()` は `QueryClient` インスタンスを返し、既定の `retry` 等が設定される
   （`queryClient.test.ts`）。
4. **ルーティング**: コードベースの router を構築でき、ホームルート（`/`）でシーン表示の枠見出しが描画される
   （`router.test.tsx` で `RouterProvider` をメモリ履歴で描画）。
5. **アプリ合成**: `AppRoot` が `ThemeProvider` + `QueryClientProvider` + `RouterProvider` を合成し、
   クラッシュせずチャンネル一覧とホーム枠を描画する（`AppRoot.test.tsx`）。
6. **依存方向**: client は `@hatchery/common` に依存し `@hatchery/server` に依存しない
   （`package.json` の依存 + ESLint 境界。#4 の `tests/dependency-direction.test.ts` で担保済み）。
7. **ビルド/起動**: `pnpm --filter @hatchery/client build`（`tsc -b && vite build`）が通り、`dev`（`vite`）が起動する。
8. **CI 緑**: `turbo run lint test build` が全ワークスペースで緑（server 最小修復含む）。

## 4. 設計方針

### モジュール構成（`client/src/`）

- `index.ts` — 純粋 barrel。`total`（docs #9 の placeholder 契約用、`a+b`）のみ。**React を import しない**。
- `theme.ts` — `slackTheme`（`createTheme`）。Slack 風ダークパレット。
- `queryClient.ts` — `createQueryClient(): QueryClient`。
- `router.tsx` — `createRootRoute` / `createRoute` / `createRouter` でコードベース定義。
  `RootLayout`（サイドバー＋`Outlet`）配下に index（`HomeScene`）。`createTestRouter`（memory history）も用意しテスト可能に。
- `routes/RootLayout.tsx` — Slack 風シェル（`ChannelList` を含むサイドバー + メイン `Outlet`）。
- `routes/HomeScene.tsx` — シーン表示の枠（見出し + プレースホルダ）。
- `components/ChannelList.tsx` — `DEFAULT_CHANNELS` を描画（client→common 実依存）。
- `AppRoot.tsx` — `ThemeProvider`+`CssBaseline`+`QueryClientProvider`+`RouterProvider` を合成。
- `main.tsx` — `createRoot(...).render(<AppRoot/>)`（SPA エントリ。`index.html` から参照）。
- `test/setup.ts` — `@testing-library/jest-dom/vitest` + RTL `cleanup`。

### ビルド / 型 / テスト

- `client/tsconfig.json`: base を継承しつつ `module: ESNext` / `moduleResolution: Bundler` / `jsx: react-jsx` /
  `lib: ES2023+DOM+DOM.Iterable` に上書き。`composite` 維持（root `tsc -b` のプロジェクト参照のため）。
- `client/vite.config.ts`: `@vitejs/plugin-react`。`build.outDir: dist/web`（tsc 出力 `dist/` と衝突回避）。
  `vitest/config` の `defineConfig` で `test`（`environment: jsdom` / `setupFiles`）も同居。
- `build` スクリプト: `tsc -b && vite build`。`dev`: `vite`。`test`: `vitest run`。`lint`: `eslint .`。
- ルート `eslint.config.mjs`: client ブロックに `globals.browser` を追加（`document`/`window` 等の `no-undef` 回避）。
- 生成物（`dist/`・`*.tsbuildinfo`）は `.gitignore` 済みでコミットしない。

## 5. 影響範囲 / 既存への変更

- **client**（主対象）: 新規 SPA 一式。`package.json`（依存・スクリプト）/`tsconfig.json` 更新。`index.ts` は `total` のみへ縮小。
- **server**: `src/index.ts` を 1 ファイル最小修復（`add`→`DEFAULT_CHANNELS`）。テストは不変。
- **docs**: 無改修（client が `total` 維持）。
- **root**: `eslint.config.mjs`（client ブラウザ globals）、`pnpm-lock.yaml` 更新。
- ESLint の依存方向制約（#4）・workspaces 定義（#4）は不変。

## 6. テスト計画（TDD で書くテスト一覧）

| テスト | 対象 | 受け入れ条件 |
|--------|------|--------------|
| `theme.test.ts` | `slackTheme` のパレット | #1 |
| `components/ChannelList.test.tsx` | `DEFAULT_CHANNELS` 全描画 | #2, #6 |
| `queryClient.test.ts` | `createQueryClient()` | #3 |
| `router.test.tsx` | ホームルート描画（memory history） | #4 |
| `AppRoot.test.tsx` | Provider 合成・クラッシュ無し | #5 |

既存の repo レベルテスト（`tests/dependency-direction.test.ts` 等）と server/docs の既存テストは緑のまま維持する。

## 7. リスク・未決事項

- **MUI v6 × React 19**: peer 依存の警告は出うるが `.npmrc` に `strict-peer-dependencies` が無いため install は失敗しない。実 API は #8、画面本実装は MVP Issue。
- **develop の broken 状態**: 本 PR で client/server を緑化し docs は据え置き。server は #6 マージ時に置換され、その際の軽微なコンフリクトは #6 側で解消する（人間承認済みの方針）。
- TanStack Router は将来ファイルベースへ移行余地があるが、本 Issue では codegen 非依存のコードベース定義に限定する。
