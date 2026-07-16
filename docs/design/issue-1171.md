# 設計書: test: client/src/routes/searchQueryParam.ts のテストを追加する (#1171)

## 1. 目的 / 背景

`client/src/routes/searchQueryParam.ts` の `parseSearchQueryParam` は `/search` route の `q` パラメータ抽出ロジックであり、`router.tsx` の `searchRoute.validateSearch` と `useSearchQueryForm.test.tsx` のテスト専用ルータの両方から共有される。コメントに「本番側の仕様変更にテストが追従しない事態を防ぐ」とあるが、この関数自体を直接検証するテストが存在せず、目的を果たせていない。

## 2. スコープ（やること / やらないこと）

- やること: `parseSearchQueryParam` 関数自体の分岐（非文字列・未指定 / 空文字・空白のみ / 前後空白付き文字列）に対するユニットテストを追加する。
- やらないこと: `router.tsx` の `validateSearch` 統合部分・`useSearchQueryForm` フック本体（既にテスト済み）のテスト。`parseSearchQueryParam` 自体の実装変更（テスト追加のみのスコープであり、既存の挙動は変更しない）。

## 3. 受け入れ条件（テストに落とせる粒度）

1. `client/src/routes/searchQueryParam.test.ts` を新設する。
2. `q` が非文字列・未指定のとき `{}` を返すことをテストする。
3. `q` が空文字・空白のみのとき `{}` を返すことをテストする。
4. `q` が前後空白付き文字列のとき、trim された値で `{ q }` を返すことをテストする。
5. `pnpm turbo run build|test|lint` が緑であること。

## 4. 設計方針（アーキ・データ構造・主要モジュール）

対象は `client/src/routes/searchQueryParam.ts` の純粋関数 `parseSearchQueryParam(search: Record<string, unknown>): { q?: string }`。既存の `client/src/utils/validateUrl.test.ts` に倣い Vitest の `describe`/`it`/`expect` を用いたプレーンなユニットテストとして `client/src/routes/searchQueryParam.test.ts` に実装する。DOM 依存・モック不要のシンプルなテストのため、既存パターンからの逸脱はない。

## 5. 影響範囲 / 既存への変更（対象ワークスペース: client / common / server / docs）

- 対象ワークスペース: `client` のみ（新規テストファイル追加）。
- `searchQueryParam.ts` 自体の実装は変更しない。
- `common` / `server` への影響なし。

## 6. テスト計画（TDDで書くテスト一覧）

`client/src/routes/searchQueryParam.test.ts`:
- `q` が `undefined` のとき `{}` を返す。
- `q` が数値（非文字列）のとき `{}` を返す。
- `q` が空文字のとき `{}` を返す。
- `q` が空白のみ（`"   "`）のとき `{}` を返す。
- `q` が前後空白付き文字列（`"  hello  "`）のとき `{ q: "hello" }` を返す。

## 7. リスク・未決事項

- 実装コードへの変更を伴わないため、TDD の「失敗確認」は「テスト対象ファイルが存在しない/未テスト」という現状に対するテスト追加であり、テスト自体は現行実装に対して初回から green になる想定（先にテストを追加し、追加直後に green であることを確認する）。
- ユーザー可視の振る舞い変更は無いため、`e2e/` の更新は不要（PR 本文にその旨を明記する）。
