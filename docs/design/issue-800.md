# Issue #800 設計書: 認証ガードのリダイレクト先を /?login=1 に統一

## 背景・目的

`client/src/router.tsx` の `requireAuth` / `requireAdminRoute` / `loginRoute` が
`redirect({ to: "/", search: { login: true } })` を渡している。
TanStack Router の qss.ts は boolean を `String(true) = "true"` にシリアライズするため、
実際の URL は `/?login=true` になる。

e2e テスト（`e2e/admin/admin.spec.ts:131` 他）と `e2e/auth/auth.spec.ts` は
`/?login=1` を期待仕様としており、リグレッションが発生している。

## 方針（選択肢 A）

`search: { login: 1 }` と数値 `1` を渡すことで `?login=1` を生成する。

- `validateRootSearch` はすでに `raw === 1` を真として受け入れている（変更不要）
- `RootSearch` の型定義を `login?: boolean | number` に拡張して `1` を受け入れる
- redirect を呼ぶ 4 箇所（`requireAuth` 2 箇所、`requireAdminRoute` 2 箇所、`loginRoute` 1 箇所）を修正

## 修正対象ファイル

- `client/src/router.tsx`: `RootSearch.login` 型を `boolean | number` に拡張し、`search: { login: 1 }` に変更

## 受け入れ条件

1. `/admin` / `/account` / `/login` への未ログインアクセス時のリダイレクト先 URL が `/?login=1` になる
2. ログインモーダルが正常に開く
3. `pnpm --filter @hatchery/client test` 緑
4. `pnpm lint` / `pnpm typecheck` 緑
