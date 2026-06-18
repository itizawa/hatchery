# 設計書: fix: Google ログインのセッション有効期限を 1 日から 1 ヶ月へ延長する (#757)

## 1. 目的 / 背景

Google ログイン後、セッション cookie の `maxAge` が 24 時間固定のため毎日ログアウトが発生する。
`maxAge` を 30 日へ延長し、ユーザーが 1 ヶ月間ログイン状態を維持できるようにする。

## 2. スコープ（やること / やらないこと）

**やること**:
- `server/src/app.ts` の `buildSessionCookieOptions` の `maxAge` を 30 日へ変更
- マジックナンバーを名前付き定数 `SESSION_MAX_AGE_MS` に切り出し（export）
- 既存テスト（`app.security.test.ts`）の `maxAge` アサーションを新しい値に更新
- `e2e/auth/usecases.md` に「ログイン後 1 ヶ月維持される」旨を追記（UC-AUTH-08）

**やらないこと**:
- スライディング有効期限（`rolling: true`）の導入（スコープ外・将来拡張）
- 有効期限の env 変数化（スコープ外）
- `pgSessionStore.ts` の変更（`connect-pg-simple` は cookie `maxAge` に自動追従するため不要）

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. `SESSION_MAX_AGE_MS === 30 * 24 * 60 * 60 * 1000 === 2_592_000_000` が export される
2. `buildSessionCookieOptions(true)` の `maxAge` が `2_592_000_000` になる
3. `buildSessionCookieOptions(false)` の `maxAge` が `2_592_000_000` になる
4. `httpOnly` / `sameSite` / `secure` の挙動は変更されない

## 4. 設計方針

変更箇所は `server/src/app.ts` のみ（1 定数 + 1 参照）。テストは `app.security.test.ts` の既存 2 件のアサーション更新のみ。

```ts
// server/src/app.ts に追加
export const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 日

export function buildSessionCookieOptions(crossSiteCookie: boolean) {
  return {
    httpOnly: true,
    sameSite: crossSiteCookie ? ("none" as const) : ("lax" as const),
    secure: crossSiteCookie,
    maxAge: SESSION_MAX_AGE_MS,
  };
}
```

## 5. 影響範囲 / 既存への変更

- `server/src/app.ts`（L68-75）: 定数追加 + 参照変更
- `server/src/app.security.test.ts`（L107-123）: `maxAge` アサーション更新
- `e2e/auth/usecases.md`: UC-AUTH-08 追記

## 6. テスト計画（TDD で書くテスト一覧）

- `buildSessionCookieOptions(true)` の `maxAge` が `2_592_000_000` になる
- `buildSessionCookieOptions(false)` の `maxAge` が `2_592_000_000` になる

（既存テストの期待値を更新することで TDD を実現）

## 7. リスク・未決事項

- `pgSessionStore.ts` の TTL: `connect-pg-simple` のデフォルト動作は cookie `maxAge` に追従するため変更不要（Issue 補足に記載の通り）。
