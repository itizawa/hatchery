# 設計書: HTTP エラー型を common に定義してサーバ全体で共有する (#72)

## 1. 目的 / 背景

現在、サーバ側のルートハンドラで HTTP エラーを返す際に `res.status(xxx).json(...)` を各所に散在させており、エラーの種類を横断的に把握・変更しにくく型安全性も低い。`AppError` を `common` に定義してサーバ全体で `throw` 統一することで、エラー処理を一元化し型安全にする。

## 2. スコープ（やること / やらないこと）

### やること
- `common/src/errors/` に `AppError`（基底）と具象クラスを定義する
- `server` の `errorHandler` が `AppError` を受け取り `statusCode` で応答するよう更新する
- 既存ルートの `res.status(4xx).json(...)` を対応するエラークラスの `throw` に置き換える

### やらないこと
- client 側でのエラー型の利用（将来の拡張として設計するが本 Issue では実装しない）
- 400 バリデーションエラー（validateBody）の変更（既存動作を維持）

## 3. 受け入れ条件（テストに落とせる粒度）

- `AppError` のサブクラスは各 `statusCode` と `message` を持つ
  - `NotFoundError` → 404
  - `BadRequestError` → 400
  - `UnauthorizedError` → 401
  - `ForbiddenError` → 403
  - `ConflictError` → 409
- `errorHandler` が `AppError` をキャッチし `statusCode` に応じたレスポンスを返す
- 既存の 413・500 変換ロジックは壊れない
- ルートの 404/400/403 エラーが `AppError` の `throw` 経由で返る（HTTP ステータスは変わらない）
- `common` には Express 等のサーバ依存がない（純粋 TypeScript クラス）

## 4. 設計方針

### エラークラス（`common/src/errors/appError.ts`）

```typescript
export class AppError extends Error {
  constructor(readonly statusCode: number, message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}
export class NotFoundError extends AppError { constructor(message = "Not Found") { super(404, message); } }
export class BadRequestError extends AppError { constructor(message = "Bad Request") { super(400, message); } }
export class UnauthorizedError extends AppError { constructor(message = "Unauthorized") { super(401, message); } }
export class ForbiddenError extends AppError { constructor(message = "Forbidden") { super(403, message); } }
export class ConflictError extends AppError { constructor(message = "Conflict") { super(409, message); } }
```

`ForbiddenError`（403）は最低限セットに加えて追加する（既存 employees.ts で 403 を返している）。

### errorHandler の更新

`AppError` のインスタンスチェックを 413 チェックの前に追加:

```typescript
if (e instanceof AppError) {
  res.status(e.statusCode).json({ error: e.message });
  return;
}
```

### ルート変更方針

- `.then()` 内の `res.status(4xx).json(...)` + `return` → `throw new XxxError(msg)`（`.catch(next)` で受け取られる）
- 同期ハンドラ内の `res.status(4xx).json(...); return;` → `next(new XxxError(msg)); return;`（Express 5 では throw も可だが、既存パターンに合わせ next を使う）

### 変更対象ファイル

| ファイル | 変更内容 |
|---------|---------|
| `common/src/errors/appError.ts` | 新規作成（エラークラス定義） |
| `common/src/errors/index.ts` | 新規作成（再エクスポート） |
| `common/src/index.ts` | `errors/index` を追加エクスポート |
| `server/src/middleware/errorHandler.ts` | AppError キャッチを追加 |
| `server/src/routes/channels.ts` | 404・400 を throw に変更 |
| `server/src/routes/employees.ts` | 403・404 を throw に変更 |

## 5. 影響範囲 / 既存への変更

- `common`: `errors/` ディレクトリを新規追加
- `server`: errorHandler・channels.ts・employees.ts を変更
- `client`: 変更なし（common に errors が増えるが、client で使用しない）
- 既存テストは HTTP ステータスを検証しているだけなので、エラー構造が変わっても通る

## 6. テスト計画

### `common/src/errors/appError.test.ts`（新規）
- 各クラスのインスタンスが `statusCode` と `message` を正しく持つ
- `instanceof AppError` が true
- `instanceof` で各サブクラスの判定ができる

### `server/src/middleware/errorHandler.test.ts`（追加）
- `AppError` を next(err) すると `statusCode` の HTTP ステータスで `{ error: message }` が返る
- 既存の 413・500 テストは変わらず通る

## 7. リスク・未決事項

- `ForbiddenError`（403）はイシュー本文の最低限セットに含まれていないが、既存コードで使用しており追加する
- `error` フィールドの値を `e.message` にすると既存テストが見ているフィールド名が変わる可能性あり → 既存テストはステータスコードのみ確認しているため問題なし
