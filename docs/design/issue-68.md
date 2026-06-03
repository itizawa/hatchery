# 設計書: fix: /auth/me レスポンスから passwordHash を除外する (#68)

## 1. 目的 / 背景

`/auth/me` エンドポイントが `req.user` をそのまま返す実装になっており、Passport の `serializeUser` / `deserializeUser` の実装次第では `passwordHash` がレスポンスに含まれるリスクがある。パスワードハッシュはサーバ内に留め、クライアントへは `{ id, displayName }` のみを返すことを保証する。

## 2. スコープ（やること / やらないこと）

### やること
- 現状の実装が `passwordHash` を除外していることを確認・ドキュメント化する
- GET `/auth/me` に専用の「passwordHash が含まれない」テストケースを追加する
- POST `/auth/login` レスポンスにも同様のテストを追加する

### やらないこと
- `req.user` の TypeScript 型の明示的な絞り込み（→ Issue #69 で対応）
- 新たなコード実装（現状の実装が既に要件を満たしている）

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

- GET `/auth/me` のレスポンスに `passwordHash` フィールドが含まれない
- POST `/auth/login` のレスポンスに `passwordHash` フィールドが含まれない
- `AuthUserSchema` に `passwordHash` が含まれない（定義を確認）
- 専用のテストケース `it("レスポンスに passwordHash が含まれない", ...)` が GET `/auth/me` に存在する

## 4. 設計方針（アーキ・データ構造・主要モジュール）

### 現状の実装（既に正しい）

- `toAuthUser(user: User): AuthUser`（`server/src/auth/passport.ts`）が `passwordHash` を含まない `AuthUser` へ変換している
- `serializeUser`: セッションにユーザー ID のみを保存
- `deserializeUser`: `toAuthUser(user)` を経由して `AuthUser` を復元 → `req.user` は `AuthUser` 型（`passwordHash` なし）
- `LocalStrategy` callback: `done(null, toAuthUser(user))` → セッション確立時も `passwordHash` をstrip済み
- `AuthUserSchema`（`common/src/domain/auth/auth.ts`）: `id`, `displayName`, `employeeId?`, `avatarUrl?` のみ（`passwordHash` なし）

### 変更対象

`server/src/routes/auth.test.ts`:
- GET `/auth/me` describe ブロックに専用テストケースを追加
- POST `/auth/login` describe ブロックに `passwordHash` 非含有テストを追加

## 5. 影響範囲 / 既存への変更

- `server/src/routes/auth.test.ts`: テスト追加のみ
- `common/`・`server/src/` 実装コード: 変更なし（既に正しい実装済み）

## 6. テスト計画（TDDで書くテスト一覧）

| テスト | 期待値 |
|--------|--------|
| GET /auth/me: レスポンスに passwordHash が含まれない | `expect(res.body).not.toHaveProperty("passwordHash")` |
| POST /auth/login: レスポンスに passwordHash が含まれない | `expect(res.body).not.toHaveProperty("passwordHash")` |

## 7. リスク・未決事項

- `req.user` の TypeScript 型が `Express.User = {}` のままで、各ルートで `as AuthUser` キャストが必要な状態 → Issue #69 で対応予定
- Issue #68 と #69 は密接に関連しており、#69 が完了した際に型キャストは不要になる
