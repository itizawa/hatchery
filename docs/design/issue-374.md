# 設計書: Issue #374 requireAuth ミドルウェアのテスト追加

## 背景・目的

`server/src/middleware/requireAuth.ts` は認証必須エンドポイント（投票・招待発行・admin 操作など）を保護する横断的ミドルウェアだが、対応する単体テストが存在しない。同じ `middleware/` 配下の `requireAdmin.ts` 等はテスト済みであり、`requireAuth` のみ認証分岐（`req.isAuthenticated()` の真偽で `next()` / `UnauthorizedError`）が回帰検証されていない。本 Issue では両分岐を直接検証するユニットテストを追加する。

## 対象コードの現仕様

`requireAuth(req, res, next)` は:

- `req.isAuthenticated()` が `true` → `next()` を引数なしで呼ぶ。
- `req.isAuthenticated()` が `false` → `next(new UnauthorizedError("Unauthorized"))` を呼ぶ（`statusCode: 401`）。

## 設計判断

- **テストのみで完結**: 対象コードは現仕様で正しく動作しており、バグは発見されなかった。実装変更は行わない（Issue のスコープどおり）。
- **テスト形式**: `server/src/middleware/requireAdmin.test.ts` と同型のスタイルを踏襲する。
  - `req` は `isAuthenticated` をスタブした `Partial<Request>`、`res` は空オブジェクト、`next` は `vi.fn()`。Express アプリ全体は起動しない。
  - `UnauthorizedError` は `@hatchery/common` から import（server → common の一方向境界を遵守）。
- **検証項目**:
  1. 認証済み（`isAuthenticated()` が `true`）: `next` が引数なしで 1 回呼ばれ、エラーを渡さない。
  2. 未認証（`isAuthenticated()` が `false`）: `next` が 1 回呼ばれ、引数が `UnauthorizedError` インスタンス（`statusCode: 401`、message `"Unauthorized"`）。

## テスト計画

- 追加ファイル: `server/src/middleware/requireAuth.test.ts`（Vitest 単体テスト）。
- `pnpm turbo run build test lint` が緑であることを確認する。

## スコープ外

- ルート結合での 401 検証（各 `routes/*.test.ts` の責務）。
