# 設計書: ユーザーに権限ロール（admin / member）を導入し、管理 API をロールで保護する (#136)

## 1. 目的 / 背景

`User` に `admin` / `member` の 2 値ロールを持たせ、管理 API（`/admin/*`）を admin ロール必須にする。
現状は `requireAuth` のみで誰でも叩けてしまうため、認証と認可を分離する。

## 2. スコープ（やること / やらないこと）

**やること:**
- `UserRole` enum（admin / member）と `User.role` を Prisma スキーマに追加
- マイグレーション（既存 User を admin にバックフィル → 新規デフォルト member）
- `common`: `UserRoleSchema`, `AuthUserSchema.role`, `isAdmin()` 純粋関数
- `server`: `User` インターフェースに `role` 追加、永続化層・passport へ通す
- `server/src/middleware/requireAdmin.ts` 新規（403 ForbiddenError）
- `/admin/*` ルータを `requireAuth` + `requireAdmin` で一括保護
- OpenAPI レジストリの `AuthUser` 定義更新（`role` フィールド追加）
- クライアント: 非 admin に管理系ナビを隠す最小ガード

**やらないこと:**
- ユーザー一覧 / ロール編集 UI
- 3 値以上のロールや細粒度パーミッション
- 招待リンク発行/受諾ロジック本体（#131/#132）

## 3. 受け入れ条件（テストに落とせる粒度）

1. `UserRoleSchema` が `z.enum(["admin", "member"])` で定義され、型が export される
2. `AuthUserSchema` に `role: UserRoleSchema` が含まれ、既存の parse（id / displayName のみ）は失敗する（role が必須）
3. `isAdmin(user)` が `user.role === "admin"` のとき `true`、それ以外で `false` を返す
4. `InMemoryUserRepository.createWithTestUser()` がデフォルトで `role: "admin"` のユーザーを生成する
5. `requireAdmin` ミドルウェアが member ユーザーに 403、admin ユーザーにはパスを返す
6. `GET /admin/settings` を member が呼ぶと 403
7. `GET /admin/settings` を admin が呼ぶと 200
8. `PATCH /auth/me` に `role` を含めても無視される（自己昇格防止）
9. `GET /auth/me` のレスポンスに `role` が含まれる

## 4. 設計方針

### マイグレーション（既存 User バックフィル）

既存 User が全員 member になるとロックアウトが起きる。以下の順序でマイグレーションを組む:
1. `UserRole` enum を追加
2. `User.role` カラムを nullable で追加
3. 既存 User を `admin` にバックフィル（`UPDATE "User" SET "role" = 'admin'`）
4. NOT NULL + DEFAULT member に変更

ただし PostgreSQL の `ALTER TYPE ... ADD VALUE` は同一トランザクションで使えない制限がある。
本 Issue のマイグレーションは手書きの SQL（prisma migrate --create-only で骨格を作り手修正）。

### 認可ミドルウェア

`requireAdmin` は `requireAuth` の後段で使う。`req.user?.role === "admin"` を判定。

### クライアント最小ガード

`RootLayout.tsx` の「管理画面」リンクを `isAdmin(user)` でガード。
サーバ側 403 が最終防衛線で、クライアントは UX のための先回りにとどめる。

## 5. 影響範囲

- `common/src/domain/auth/auth.ts` — `UserRoleSchema`, `isAdmin`, `AuthUserSchema` 更新
- `server/prisma/schema.prisma` — `UserRole` enum, `User.role`
- `server/prisma/migrations/` — 新規マイグレーション
- `server/src/persistence/userRepository.ts` — `User` interface に `role` 追加
- `server/src/persistence/prismaUserRepository.ts` — `role` を含む
- `server/src/auth/passport.ts` — `toAuthUser()` に `role`
- `server/src/middleware/requireAdmin.ts` — 新規
- `server/src/routes/admin.ts` — ルータ単位で `requireAdmin` 追加
- `server/src/openapi/registry.ts` — `AuthUser` コンポーネントに `role`
- `client/src/routes/RootLayout.tsx` — 管理画面リンクを admin のみ表示

## 6. テスト計画

- `common/src/domain/auth/auth.test.ts` — `UserRoleSchema` parse / `isAdmin` の全分岐
- `server/src/middleware/requireAdmin.test.ts` — member→403 / admin→pass / 未認証→401
- `server/src/routes/admin.test.ts` — member→403 のケース追加

## 7. リスク・未決事項

- **バックフィル方針**: 既存 User が `admin` になる点は意図的。初期 admin は DB バックフィルで用意し、以後は招待受諾 (#132) で作られる User が `member` になる。
- **トークン平文 vs ハッシュ保存**: 本 Issue はロール基盤のみ。招待トークン設計は #131 の責務。
- `UserRepository.create` は本 Issue では定義のみ（`role?: "admin" | "member"` 省略可・既定 member）とし、#132 が使う形にする。
