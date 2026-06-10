# 設計書: 全画面の URL（ルート）一覧ドキュメントを新設し scene MDX のリンク切れを解消 (#200)

## 1. 目的 / 背景

- 各 scene MDX（login / settings / account）に `参照: [`docs/design/url-list.md`](./url-list.md)` というリンクがあるが、リンク先（`docs/src/url-list.md` 相当）が存在せず **リンク切れ**になっている。さらにラベル（`docs/design/url-list.md`）とパス（`./url-list.md`）が不整合。
- 先行 Issue #105 で正本 `docs/design/url-list.md`（全画面 URL 一覧テーブル）は新設済みだが、**ADR-0007 が要求する「MDX 薄いラッパー（`docs/src/url-list.mdx`）で Storybook に取り込む」部分が未実装**で、Storybook 上に URL 一覧ページが存在しない。そのため scene MDX からのリンクも辿れない。
- ADR-0007: ドキュメントは `.md` を Git 上の正本（レビュー対象）にし、Storybook では MDX の薄いラッパー（`?raw` インポート + `<pre>`）から取り込んで表示する（参照実装: `docs/src/adr/0007.mdx`）。

## 2. スコープ（やること / やらないこと）

### やること
- `docs/src/url-list.mdx`（薄いラッパー）を新設し、`docs/design/url-list.md` を `?raw` インポートして Storybook で表示する（参照実装: `docs/src/adr/0007.mdx`）。
- scene MDX（login / settings / account）のリンク切れ・ラベル/パス不整合を解消し、Storybook 上の URL 一覧ページを指す有効なリンクに直す。
- home-feed-scene.mdx に URL 一覧への参照を追加し、認証要否記述（`/` 必須 → 不要）を router・url-list.md と矛盾しない状態に修正する。

### やらないこと
- `docs/design/url-list.md` のテーブル内容の再設計（#105 で完了済み・router を正とする内容は維持）。
- 画面項目（フィールド）明細表の追加（別 Issue・`field-specs.mdx` が担当）。
- client / server / common の変更（本 Issue は docs ワークスペースのみ）。

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. `docs/src/url-list.mdx` が存在する。
2. `docs/src/url-list.mdx` が `docs/design/url-list.md` を `?raw` でインポートしている（正本 .md を取り込む薄いラッパー）。
3. `docs/src/url-list.mdx` が `<Meta title=...>` を持ち、Storybook の `../src/**/*.mdx` グロブで取り込まれる（`docs/src/` 配下に配置）。
4. scene MDX（login / settings / account / home-feed）の url-list 参照リンクが実在を指す（リンク切れなし）。`docs/src/*.mdx` に残る `(./url-list.md)` 形式の壊れた相対リンクが存在しない。
5. home-feed-scene.mdx の `/` 認証要否が router（`beforeLoad` なし＝ゲスト可）と矛盾しない（「必須」と書かない）。
6. `pnpm turbo run build test lint` が緑。

## 4. 設計方針（アーキ・データ構造・主要モジュール）

- **MDX ラッパー**: `docs/src/adr/0007.mdx` を踏襲。`import content from "../design/url-list.md?raw";` + `<Meta title="設計/画面URL一覧（ルーティング表）" />` + `<pre>{content}</pre>`。正本は `.md`、MDX は表示専用の薄いラッパー（ロジックを持たない）。
- **scene MDX のリンク修正**: 壊れた `参照: [`docs/design/url-list.md`](./url-list.md)` を、正本ファイルパスを示すプレーン参照に置換する。Storybook の MDX 間リンクはファイル相対では解決されないため、正本ファイルパス `docs/design/url-list.md` を `code` で明示する表記に統一し、ラベル/パス不整合とリンク切れの両方を解消する。
- **home-feed-scene.mdx**: URL/ルート表の認証列を router 実態（`/` は `beforeLoad` なし＝ゲスト可）に合わせ「不要（ゲスト可）」へ修正し、url-list への参照行を追加。

## 5. 影響範囲 / 既存への変更（対象ワークスペース）

- `docs/` のみ。
  - 新規: `docs/src/url-list.mdx`、`tests/url-list-mdx.test.ts`（リポジトリ規約テスト）。
  - 変更: `docs/src/{login,settings,account,home-feed}-scene.mdx`。
- client / server / common / OpenAPI 型共有フローへの影響なし。依存方向に変化なし。

## 6. テスト計画（TDD で書くテスト一覧）

`tests/url-list-mdx.test.ts`（vitest・リポジトリ規約テスト）:
- `docs/src/url-list.mdx` が存在する。
- そのラッパーが `url-list.md?raw` を import している。
- そのラッパーが `<Meta title=...>` を持つ。
- `docs/src/*.mdx` のどれにも壊れた相対リンク `(./url-list.md)` が残っていない。
- url-list を参照する scene MDX が `docs/design/url-list.md`（正本パス）を含む形で参照している。
- home-feed-scene.mdx の URL 表で `/` を「必須」と記載していない。

## 7. リスク・未決事項

- Storybook の MDX 間ハイパーリンク解決は標準では効かないため、本 Issue では「正本ファイルパスを明示する参照表記」に統一する方針（リンク切れ＝壊れた相対パスの撤去）で AC5 を満たす。実体験できるナビゲーションは Storybook サイドバーの「設計/画面URL一覧」ページで担保する（AC6）。
