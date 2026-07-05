# 設計書: メンテナンスされていない Storybook を廃止する (#1076)

## 1. 目的 / 背景

ADR-0007 で `docs` ワークスペースに Storybook 8 を構築し、設計 MDX と client のコンポーネントカタログを GitHub Pages にデプロイする方針を決定した。しかし現状メンテナンスされておらず、`#166`・`#63`・`#107`・`#198` など Storybook 起因の不具合が繰り返し発生していた。運用コストに見合う価値を生めていないため撤去する。

## 2. スコープ（やること / やらないこと）

**やること**

- `docs` ワークスペースの Storybook 関連依存・設定・CI ワークフローの削除。
- `client/src` の `*.stories.tsx`（7 ファイル）の削除。
- `docs/src` の Storybook 専用ファイル（MDX・Storybook 前提テスト）の削除。
- Storybook 削除後に完全に参照者を失う付随コード（`MarkdownDoc` コンポーネント、`fieldSpec` 抽出ロジック、`gen-field-specs` 生成スクリプト）の削除。いずれも唯一の消費者だった MDX ページ自体を削除するため、削除後は死んだコードになる。
- ADR-0007 のステータス更新（Superseded）と、撤去の決定を記録する新規 ADR-0037 の追加。

**やらないこと**

- 設計書・ADR の閲覧手段を Storybook 以外で再構築すること（別 Issue のスコープ）。
- `docs/design/*.md`・`docs/adr/*.md`（Markdown 正本）自体の削除・変更。

## 3. 受け入れ条件（テストに落とせる粒度）

1. `docs/package.json` から Storybook 関連 script・devDependencies が無いこと。
2. `client/src` 配下に `*.stories.tsx` が 0 件であること。
3. `docs/src` 配下に Storybook 専用ファイル（MDX 全般・`storybook-preview.test.ts`・`storybook-base-path.test.ts`・`adr-mdx-render.test.ts`）が無いこと。MDX 削除により消費者を失う `MarkdownDoc`・`fieldSpec` 関連ファイルも削除されていること。
4. `.github/workflows/deploy-storybook.yml` が存在しないこと。
5. `turbo.json` に `storybook:build` / `@hatchery/docs#storybook:build` / `gen-field-specs` / `@hatchery/client#build` の `gen-field-specs` 依存が残っていないこと。
6. `docs/.storybook` が存在しないこと。
7. ADR-0007 のステータスが `Superseded by ADR-0037` になっており、新規 ADR-0037（撤去の決定）が `docs/adr/README.md` の一覧に追記されていること。
8. `pnpm turbo run build` / `pnpm turbo run test` / `pnpm turbo run lint` が全ワークスペースで緑であること。
9. client → common / server → common の一方向 import 境界を変更しないこと。

## 4. 設計方針

- 削除のみのタスクであるため、TDD の「まずテストを書く」は「削除後に build/test/lint が通ることを確認する」フェーズに読み替える（既存の実装コードを対象にした振る舞いテストは存在しないため、新規テスト追加は不要）。
- `MarkdownDoc.tsx` は Storybook 固有 API に依存しないが、`docs/src` 全体を検索した結果、唯一の消費者は削除対象の `adr/0007.mdx` だった。削除後に永続的な死コードになるため、あわせて削除する。
- `fieldSpec/`（`extractFieldSpecs.ts` / `formSpecs.ts` / `types.ts` / テスト）・`gen-field-specs.ts` は `field-specs.mdx`（Storybook ページ）を生成するためだけに存在し、他のどこからも参照されていない（`grep -rln "FORM_SPECS|extractFieldSpecs|gen-field-specs"` で確認）。ページごと削除する。
- `docs/public/mockServiceWorker.js` は `.storybook/preview.tsx` の MSW 初期化専用アセットで、他に参照が無いため削除する。
- `docs/src/test/setup.ts`（RTL cleanup）と `docs/vitest.config.ts` の jsdom / esbuild jsx / MUI inline 設定は、唯一 RTL を使っていた `MarkdownDoc.test.tsx` の削除後は不要になるため、`vitest.config.ts` を素の Node 環境設定に簡素化し `test/setup.ts` を削除する。
- `docs/package.json` の dependencies/devDependencies も、削除後に import されなくなるもの（`@mui/material` / `@emotion/*` / `@tanstack/react-query` / `markdown-to-jsx` / `zod` / `@testing-library/*` / `jsdom` / `tsx` 等）を棚卸しして除去する。

## 5. 影響範囲 / 既存への変更

対象ワークスペース: `docs`（主）・`client`（`*.stories.tsx` 削除のみ）。`server`・`common` への変更なし。CI: `.github/workflows/deploy-storybook.yml` 削除。

## 6. テスト計画

新規テストは追加しない（削除タスクのため）。削除後に以下を確認する:

- `pnpm turbo run build`
- `pnpm turbo run test`
- `pnpm turbo run lint`

いずれも全ワークスペースで green であることを確認する。

## 7. リスク・未決事項

- `docs` ワークスペースの依存を大きく減らすため、`docs/package.json` の残存 dependencies（`react` / `react-dom` 等）が実際に `docs/src/index.ts` から不要であればさらに削れるが、本 Issue のスコープ（Storybook 撤去）を超えるため深追いしない。
