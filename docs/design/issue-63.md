# 設計書: fix: Storybook の preview.tsx で ReferenceError: React is not defined を解消する (#63)

## 1. 目的 / 背景

GitHub Pages にデプロイされた Storybook で全ストーリーが `ReferenceError: React is not defined` で表示されない問題を修正する。
`docs/.storybook/preview.tsx` が JSX 構文を使用しているが、`import React from 'react'` がないため、Storybook のビルドパイプラインで自動 JSX 変換が適用されずに発生するランタイムエラー。

## 2. スコープ（やること / やらないこと）

**やること**
- `docs/.storybook/preview.tsx` に `import React from 'react'` を追加する
- 追加後も TypeScript 型チェックが通ることを確認する

**やらないこと**
- Vite の React プラグイン設定変更（最小変更で確実に修正できるため不要）
- Storybook の他の設定変更

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

- `docs/.storybook/preview.tsx` の先頭に `import React from 'react'` が追加されている
- `preview` のデフォルトエクスポートが `decorators` 配列を持つ（モジュールとして正常にインポートできる）
- `pnpm --filter @hatchery/docs test` が緑（既存テスト維持 + 新規スモークテスト追加）
- `pnpm --filter @hatchery/docs lint` が緑

## 4. 設計方針（アーキ・データ構造・主要モジュール）

**根本原因**: `@storybook/react-vite` が提供する Vite ビルドパイプラインは、`viteFinal` での `resolve.alias` カスタマイズのみで `@vitejs/plugin-react` の JSX 自動変換が `.storybook/` 配下のファイルに正しく適用されないケースがある。

**修正方針**: React 17 以降の自動 JSX 変換（`automatic` runtime）への依存をやめ、明示的に `import React from 'react'` を追加する。これは最小変更かつ後方互換性のある確実な修正。

## 5. 影響範囲 / 既存への変更（対象ワークスペース）

- `docs/`: `docs/.storybook/preview.tsx`（1 行追加のみ）

## 6. テスト計画（TDDで書くテスト一覧）

- `docs/src/storybook-preview.test.ts`: preview.tsx をインポートし `decorators` 配列が定義されていることを検証するスモークテスト

## 7. リスク・未決事項

- Vitest は自動 JSX 変換を行うため、このテストは fix 前後どちらでも通る可能性がある（ランタイムエラーは Storybook の本番ビルド環境固有の問題）
- 本質的な検証は CI の `Deploy Storybook to GitHub Pages` ワークフローで行われる
