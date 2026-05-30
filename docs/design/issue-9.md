# 設計書: Setup: docs/Storybook 8 + 設計 MDX + GitHub Pages デプロイ (#9)

## 1. 目的 / 背景

ADR-0007（ドキュメント基盤）に従い、`docs/` ワークスペースに **Storybook 8（Vite ビルダー）** をセットアップし、client のコンポーネント stories と設計 MDX を集約して GitHub Pages へ静的デプロイする基盤を整える。

現在 `docs/src/index.ts` には「#9 で差し替える」旨のプレースホルダーがある。本 Issue で Storybook 設定と最初の story・MDX ラッパーを実装する。

## 2. スコープ（やること / やらないこと）

### やること
- `docs/.storybook/main.ts` — Storybook 8（`@storybook/react-vite`）設定。`client/src/**/*.stories.tsx` を取り込む
- `docs/.storybook/preview.tsx` — MUI slackTheme デコレーター設定
- `client/src/components/ChannelList.stories.tsx` — 最初の story（`ChannelList`）
- `docs/src/adr/0007.mdx` — ADR-0007 を薄い MDX ラッパーで表示（`?raw` インポート）
- `docs/package.json` に Storybook scripts (`storybook`, `storybook:build`) と devDependencies を追加
- `turbo.json` に `storybook:build` タスクを追加（依存: `^build`、出力: `storybook-static/**`）
- `.github/workflows/deploy-storybook.yml` — GitHub Pages デプロイワークフロー雛形

### やらないこと
- MVP コンポーネント全 story の整備（受け入れ条件は最小 1 story）
- ドキュメントコンテンツの拡充（ADR 全件の MDX ラッパー化）
- GitHub Pages の公開設定（リポジトリ Settings は人間が行う）

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

- `client/src/components/ChannelList.stories.tsx` が `default` エクスポートとして `meta.component === ChannelList` を持つ
- `client/src/components/ChannelList.stories.tsx` が `Default` story をエクスポートする
- `docs/.storybook/main.ts` が存在し、`stories` に `client` の `*.stories.tsx` パターンを含む
- `docs/src/adr/0007.mdx` が存在し、MDX 構成を確認できる

## 4. 設計方針（アーキ・データ構造・主要モジュール）

### Storybook 設定

`docs/.storybook/main.ts` で以下を設定:
- **framework**: `@storybook/react-vite`（Vite ビルダー、ADR-0003 と共有）
- **stories**: `../../client/src/**/*.stories.@(js|jsx|mjs|ts|tsx)` と `../src/**/*.mdx`
- **addons**: `@storybook/addon-essentials`（docs・controls・actions などを含む）

`docs/.storybook/preview.tsx` で以下を設定:
- MUI `ThemeProvider` + `CssBaseline` デコレーター（`slackTheme` を `@hatchery/client` から取得）

### ADR の薄い MDX ラッパー

`docs/adr/*.md` が正本。MDX ラッパーは Vite の `?raw` インポートでファイル内容を文字列として読み込み、`<pre>` タグで表示する。これにより:
- `.md` ファイルの差分がレビューで読みやすい状態を保つ
- 追加の markdown レンダリングライブラリ不要

### GitHub Pages デプロイ

GitHub Actions ワークフロー（`.github/workflows/deploy-storybook.yml`）:
- トリガー: `develop` または `main` への push
- ジョブ: pnpm install → `turbo run storybook:build` → `actions/upload-pages-artifact` → `actions/deploy-pages`

### Turborepo タスク

`storybook:build` を `build` とは別タスクとして追加:
- `dependsOn: ["^build"]`（client・common のビルドが先行）
- `outputs: ["storybook-static/**"]`（ビルド成果物）

`docs/package.json` の `build` スクリプトは Storybook ビルドに変更（`turbo run build` で docs の Storybook も生成される）。

## 5. 影響範囲 / 既存への変更

| ワークスペース | 変更 |
|---|---|
| `docs/` | `package.json` 更新（Storybook devDeps 追加・scripts 更新）、`.storybook/` ディレクトリ新設、`src/adr/0007.mdx` 追加 |
| `client/` | `src/components/ChannelList.stories.tsx` 追加、`src/components/ChannelList.stories.test.ts` 追加 |
| ルート | `turbo.json` 更新（`storybook:build` タスク追加）、`.github/workflows/deploy-storybook.yml` 追加 |

既存の `docs/src/index.ts` と `docs/src/index.test.ts`（`docsChannelCount` のプレースホルダーテスト）は維持する。

## 6. テスト計画（TDD で書くテスト一覧）

| テストファイル | 内容 | テスト対象 |
|---|---|---|
| `client/src/components/ChannelList.stories.test.ts` | `meta.component === ChannelList` の確認 | `ChannelList.stories.tsx` |
| `client/src/components/ChannelList.stories.test.ts` | `Default` story のエクスポート確認 | `ChannelList.stories.tsx` |

Storybook の設定ファイル（`main.ts`・`preview.tsx`）は Storybook のビルドが通ることを受け入れ基準とし、`storybook build` の成功をもって確認する。

## 7. リスク・未決事項

- `@hatchery/client` は `dist/index.js`（`tsc -b` 出力）をエントリとして公開しているため、Storybook ビルド前に `client` のビルドが必要。`turbo.json` の `^build` 依存で順序を保証する。
- `slackTheme` は `client/src/theme.ts` で定義・`index.ts` でエクスポートされているが、Storybook の preview.tsx から参照するためにはパッケージ API 経由（`@hatchery/client`）が必要。client の `dist/` が最新かを Turborepo が保証する。
- GitHub Pages 公開設定（Settings → Pages の source 設定）はリポジトリ管理者（人間）が行う必要がある。本 Issue ではワークフロー雛形の提供のみ。
