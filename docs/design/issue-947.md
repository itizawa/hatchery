# 設計書: test: admin.posts.test.ts の POST /api/admin/posts・comments の詳細バリデーション（400 / 404 系）テストを追加する (#947)

## 1. 目的 / 背景

`server/src/routes/admin.posts.test.ts` には、管理者用の post / comment 作成エンドポイントの
正常系・基本的な存在チェック（404）はテスト済みだが、Zod スキーマによる最大文字数バリデーション（400 系）の
テストが不足している。バリデーション設定ミスの検出遅れを防ぐためにテストカバレッジを拡充する。

## 2. スコープ（やること / やらないこと）

**やること:**
- `POST /api/admin/posts` の title / text 最大文字数超過テスト（400）を追加
- `POST /api/admin/comments` の text 最大文字数超過テスト（400）を追加

**やらないこと:**
- 実装コードの変更（Zod バリデーションは `common/` で実装済み）
- 認証（401/403）テストの追加（既存でカバー済み）

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. `POST /api/admin/posts`: title が `POST_TITLE_MAX_LENGTH`（100）文字を超えるとき 400 を返す
2. `POST /api/admin/posts`: text が `POST_TEXT_MAX_LENGTH`（1000）文字を超えるとき 400 を返す
3. `POST /api/admin/comments`: text が `COMMENT_TEXT_MAX_LENGTH`（1000）文字を超えるとき 400 を返す
4. `pnpm turbo run test --filter=@hatchery/server` が緑

## 4. 設計方針（アーキ・データ構造・主要モジュール）

- テストのみ追加。実装コードは変更しない。
- 既存テストパターン（`makeRepos()` / `makeApp()` / `loginAgent()`）を再利用する。
- `POST_TITLE_MAX_LENGTH`・`POST_TEXT_MAX_LENGTH`・`COMMENT_TEXT_MAX_LENGTH` は
  `common/src/domain/` からインポートして参照（ハードコーディングしない）。
- `"a".repeat(N + 1)` で上限+1文字の文字列を生成してリクエストに渡す。

## 5. 影響範囲 / 既存への変更

- **server**: `server/src/routes/admin.posts.test.ts`（テスト追加のみ）
- **client / common / docs**: 変更なし

## 6. テスト計画（TDDで書くテスト一覧）

| # | describe | テスト名 | 期待結果 |
|---|----------|----------|---------|
| 1 | POST /api/admin/posts | title が最大文字数（100）を超えるとき 400 を返す | status 400 |
| 2 | POST /api/admin/posts | text が最大文字数（1000）を超えるとき 400 を返す | status 400 |
| 3 | POST /api/admin/comments | text が最大文字数（1000）を超えるとき 400 を返す | status 400 |

## 7. リスク・未決事項

なし。実装済みの Zod スキーマ（`CreatePostRequestSchema` / `CreateCommentRequestSchema`）が
`validateBody` ミドルウェアで適用されているため、テストは通るはず。
