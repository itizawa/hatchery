# 設計書: test: e2e/search に search.spec.ts を新設し UC-SEARCH-01〜09 を Playwright テストとして実装する (#1097)

## 1. 目的 / 背景

`e2e/search/usecases.md`（投稿全文検索 `/search`、#751・#1055・#1075・#1058・#1059）には `## UC-SEARCH-01`〜`## UC-SEARCH-10` の 10 件のユースケースが定義されているが、対応する `e2e/search/search.spec.ts` が存在しない。CLAUDE.md の e2e ユースケース保守ルールは「`## UC-XXX-NN` 見出しは同エリアの `spec.ts` の `test.todo()` と 1:1 対応」させることを正本としており、この機能領域は usecases.md が先行して書かれたまま Playwright 実装が丸ごと抜けている。

## 2. スコープ（やること / やらないこと）

### やること

- `e2e/search/search.spec.ts` を新設し、usecases.md の UC-SEARCH-01〜10 それぞれに対応する `test()` または `test.todo()` を 1:1 で用意する。
- Issue 本文で明示された UC-SEARCH-01・04・06・07 を実テストとして実装する（`page.route()` で API をモックし、バックエンドなしでブラウザ側の挙動を検証する既存パターンに従う）。
- 未実装分（UC-SEARCH-02・03・05・08・09・10）は `test.todo()` で明示する。

### やらないこと

- UC-SEARCH-02・03・05・08・09・10 の実テスト化（本 Issue のスコープ外。後続 Issue で拡張可能な状態にする）。
- `SearchScene` / `useSearchPosts` / ヘッダー検索欄（`AppHeader`）の実装変更（挙動は変えない。テスト追加のみ）。
- e2e を CI（`pnpm turbo run build test lint`）に組み込むこと（`playwright.config.ts` のコメント通り、e2e の CI 組み込みは別 Issue の範囲）。

## 3. 受け入れ条件（テストに落とせる粒度）

1. `e2e/search/search.spec.ts` が存在し、UC-SEARCH-01〜10 の 10 件すべてに対応する `test()`/`test.todo()` を持つ。
2. UC-SEARCH-01: ヘッダー検索欄にキーワードを入力し Enter を押すと `/search?q=<キーワード>` へ遷移し検索結果が表示される。
3. UC-SEARCH-04: `/search` を開いた状態でヘッダー検索欄からキーワードを入力し Enter を押すと、URL が更新され、ヒットした投稿が新着順で一覧表示され、「N 件の投稿が見つかりました」の件数表示が出る。
4. UC-SEARCH-06: ヒットしないキーワードで検索すると「「<キーワード>」に一致する投稿が見つかりませんでした。」が表示される。
5. UC-SEARCH-07: クエリパラメータなしで `/search` を開くと「キーワードを入力して投稿を検索できます。」の案内テキストが表示される。
6. `pnpm turbo run build|test|lint` が緑であること（e2e はこのタスクの対象外だが、実際に `pnpm e2e` でも通過することをローカルで確認する）。

## 4. 設計方針（アーキ・データ構造・主要モジュール）

- 既存の `e2e/community/community.spec.ts`・`e2e/about/about.spec.ts` と同じパターンを踏襲する:
  - `import { expect, test } from "../support/test.js"`（`test.todo()` ラッパー付き）。
  - `page.route("**/api/auth/me", ...)` で未認証をモック（`/search` は認証不要ページ）。
  - `page.route("**/api/communities", ...)` でヘッダー・サイドバー描画に必要な最低限のコミュニティ一覧をモック。
  - `page.route("**/api/posts/search**", ...)` で `GET /api/posts/search`（`client/src/api/search.ts` の `fetchSearchPosts`）をモックし、検索結果件数・0件・ヒット時の投稿データを制御する。
- モック投稿データは `client/src/api/search.test.ts` の `mockPost` 相当の形（`id` / `community_id` / `slot_key` / `seq` / `author` / `title` / `text` / `score` / `created_at` / `comment_count`）に合わせる（`Post` 型、`client/src/api/search.ts`）。
- ヘッダー検索欄の入力操作は `page.getByRole("searchbox", { name: "投稿を検索" })`（`AppHeader.tsx` の `HeaderSearchField`、`aria-label: HEADER_SEARCH_LABEL = "投稿を検索"`）を使う。
- UC-SEARCH-01 はトップページ（`/`）から、UC-SEARCH-04/06/07 は `/search` を起点にする（usecases.md の前提条件通り）。

## 5. 影響範囲 / 既存への変更（対象ワークスペース）

- `e2e/` のみ（新規ファイル追加）。`client` / `server` / `common` のプロダクトコードは変更しない。

## 6. テスト計画（TDDで書くテスト一覧）

- UC-SEARCH-01（実テスト）: ヘッダー検索欄からの遷移。
- UC-SEARCH-04（実テスト）: `/search` 上での検索実行と結果表示・件数表示。
- UC-SEARCH-06（実テスト）: 0 件時の「見つかりませんでした」表示。
- UC-SEARCH-07（実テスト）: クエリなし時の案内テキスト表示。
- UC-SEARCH-02・03・05・08・09・10（`test.todo()`）。

## 7. リスク・未決事項

- usecases.md には Issue 本文の言及にない UC-SEARCH-10（#1059・vote 済み表示）が存在する。CLAUDE.md の「`## UC-XXX-NN` は spec.ts の `test.todo()` と 1:1 対応」の原則を優先し、UC-SEARCH-10 も `test.todo()` として含める（1:1 対応を崩さないため）。
- e2e はローカルの `pnpm e2e`（client dev server 起動が前提）でのみ実行し、CI パイプラインには含めない（既存方針を踏襲）。
