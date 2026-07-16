# 設計書: test: client/src/utils/validateUrl.ts のテストを追加する (#1170)

## 1. 目的 / 背景

`client/src/utils/validateUrl.ts` は `@tanstack/react-form` の onChange/onBlur バリデータとして `AccountScene`（avatarUrl）と `CommunityFormFields`（feedUrl）で共有される小さな純粋関数だが、対応するテストファイルが存在しない。空文字（任意項目扱い）・有効な URL・無効な URL の3分岐を持ち、複数フォームから共有される検証ロジックのため、退行時の影響範囲が広い。

## 2. スコープ（やること / やらないこと）

- やること: `validateUrl` 関数自体の3分岐（空文字 / 有効 URL / 無効 URL）に対するユニットテストを追加する。
- やらないこと: `AccountScene`・`CommunityFormFields` 側の統合テスト（既存の component test で一部カバー済み）。`validateUrl.ts` の実装変更（テスト追加のみのスコープであり、既存の挙動は変更しない）。

## 3. 受け入れ条件（テストに落とせる粒度）

1. `client/src/utils/validateUrl.test.ts` を新設する。
2. 空文字を渡すと `undefined`（valid 扱い）を返すことをテストする。
3. 有効な URL（例: `https://example.com`）を渡すと `undefined` を返すことをテストする。
4. 無効な URL（例: `not a url`）を渡すとエラーメッセージ文字列（`"有効な URL を入力してください"`）を返すことをテストする。
5. `pnpm turbo run build|test|lint` が緑であること。

## 4. 設計方針（アーキ・データ構造・主要モジュール）

対象は `client/src/utils/validateUrl.ts` の純粋関数 `validateUrl(value: string): string | undefined`。既存の `client/src/sw.test.ts` に倣い Vitest の `describe`/`it`/`expect` を用いたプレーンなユニットテストとして `client/src/utils/validateUrl.test.ts` に実装する。DOM 依存・モック不要のシンプルなテストのため、既存パターンからの逸脱はない。

## 5. 影響範囲 / 既存への変更（対象ワークスペース: client / common / server / docs）

- 対象ワークスペース: `client` のみ（新規テストファイル追加）。
- `validateUrl.ts` 自体の実装は変更しない。
- `common` / `server` への影響なし。

## 6. テスト計画（TDDで書くテスト一覧）

`client/src/utils/validateUrl.test.ts`:
- 空文字を渡すと `undefined` を返す。
- 有効な URL（`https://example.com`）を渡すと `undefined` を返す。
- 無効な URL（`not a url`）を渡すとエラーメッセージ文字列を返す。

## 7. リスク・未決事項

- 実装コードへの変更を伴わないため、TDD の「失敗確認」は「テスト対象ファイルが存在しない/未テスト」という現状に対するテスト追加であり、テスト自体は現行実装に対して初回から green になる想定（先に `describe.skip`/未実装ではなく通常のテストとして追加し、追加直後に green であることを確認する）。
- ユーザー可視の振る舞い変更は無いため、`e2e/` の更新は不要（PR 本文にその旨を明記する）。
