# 設計書: HTTP エラー型を common に定義してサーバ全体で共有する (#72)

## 1. 目的 / 背景

ADR-0001（monorepo 境界）と ADR-0005（common の純粋性）に従い、HTTP エラー型を `common` に定義してサーバ全体で共有する。
現状、ルートハンドラが `res.status(xxx).json(...)` を各所に散在させており、エラーの種類を横断的に把握・変更が困難で型安全性も低い。

## 2. スコープ（やること / やらないこと）

### やること

- `common/src/errors/` に HTTP エラー型の基底クラス `AppError` と具象クラスを定義する
- `server/src/middleware/errorHandler.ts` を `AppError` に対応させる
- 既存ルートハンドラの `res.status(xxx).json(...)` 直接書きを `throw` / `next(err)` に置き換える
- `common/src/index.ts` からエラークラスを再エクスポートする

### やらないこと

- client 側でのエラー型利用（将来拡張として設計だけ配慮）
- HTTP 以外のエラー型定義

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

- `AppError` は `statusCode: number` と `message: string` を持つ
- `NotFoundError(404)`・`BadRequestError(400)`・`UnauthorizedError(401)`・`ForbiddenError(403)`・`ConflictError(409)` が正しい statusCode を持つ
- `errorHandler` が `AppError` インスタンスを catch し、`statusCode` に応じたレスポンスを返す
- 既存の 413 / 500 変換ロジックが維持される
- `PATCH /channels/:id` に存在しない id を指定すると 404 が返る
- `PATCH /employees/:id` で他ユーザーの Employee を更新しようとすると 403 が返る
- `POST /channels/:channelId/messages` で存在しない channelId を指定すると 404 が返る
- 全テスト緑・lint 通過

## 4. 設計方針（アーキ・データ構造・主要モジュール）

### エラークラス階層

```
AppError (common/src/errors/AppError.ts)
  ├── NotFoundError      (404)
  ├── BadRequestError    (400)
  ├── UnauthorizedError  (401)
  ├── ForbiddenError     (403)
  └── ConflictError      (409)
```

- `AppError extends Error` でネイティブ Error を継承
- `common` は Express に依存しない純粋 TypeScript クラス（ADR-0005）
- エラーメッセージは従来の `error` レスポンスキーの値（例: `"ChannelNotFound"`）と統一

### errorHandler の変更方針

既存の 413 ガードを維持しつつ、`AppError` インスタンスを `instanceof` で判定して `statusCode` に応じてレスポンスを返す。優先順位: 413判定 > AppError判定 > 500（Unknown）

### ルートハンドラのリファクタ方針

- Promise チェーン内の `res.status(xxx).json(...)` → `throw new XxxError(message)` に置き換え（throw が `.catch(next)` 経由で errorHandler に到達）
- 同期ハンドラ内の直接レスポンス → `next(new XxxError(message)); return;` に置き換え（明示的に Express の next チェーンへ流す）

## 5. 影響範囲 / 既存への変更

| ファイル | 変更内容 |
|---------|---------|
| `common/src/errors/AppError.ts` | 新規追加（エラークラス定義） |
| `common/src/errors/index.ts` | 新規追加（再エクスポート） |
| `common/src/errors/AppError.test.ts` | 新規追加（ユニットテスト） |
| `common/src/index.ts` | `errors/` を追加エクスポート |
| `server/src/middleware/errorHandler.ts` | AppError ハンドリング追加 |
| `server/src/middleware/errorHandler.test.ts` | AppError テスト追加 |
| `server/src/routes/channels.ts` | 404/400 を throw に変更 |
| `server/src/routes/employees.ts` | 403/404 を next(err) / throw に変更 |

## 6. テスト計画（TDD で書くテスト一覧）

### common/src/errors/AppError.test.ts（新規）

- `AppError` の statusCode と message が正しく設定される
- 各具象クラスの statusCode が正しい（NotFoundError=404 等）
- `instanceof AppError` チェックが正しく機能する

### server/src/middleware/errorHandler.test.ts（追加）

- `AppError` インスタンスを next() すると `statusCode` に応じた HTTP レスポンスが返る
- `NotFoundError("ChannelNotFound")` が 404 で `{ error: "ChannelNotFound" }` を返す

## 7. リスク・未決事項

- `ForbiddenError(403)` は Issue 要件の「最低限リスト」外だが、`employees.ts` の 403 を既に利用しているため追加する
- client 側での AppError 利用は本 Issue スコープ外
