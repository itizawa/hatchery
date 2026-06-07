# 設計書: DB の主キー id を UUIDv7 採番に統一し、User はサロゲートキー化＋loginId を新設する (#185)

## 1. 目的 / 背景

DB の主キー id 生成方式がモデルごとに混在（cuid / UUIDv4 / 自前供給）しており、`User.id` にはログインID文字列をそのまま使用していた。
全モデルの主キーを Prisma の `@default(uuid(7))` に統一し、User はサロゲートキー化して `loginId` を新設する。

## 2. スコープ（やること / やらないこと）

**やること:**
- 全モデルの `id` に `@default(uuid(7))` を付与
- `User` に `loginId String @unique` を新設
- 認証を `loginId` ベースへ変更（`findByLoginId` 追加）
- common の `LoginRequestSchema` / `AcceptInvitationSchema` の `id` フィールドを `loginId` にリネーム
- `AuthUserSchema` に `loginId` を追加
- クライアントフォームを `loginId` 対応に更新
- Prisma マイグレーション追加
- シードデータ更新

**やらないこと:**
- email ログイン化
- `loginId` 変更 UI
- 既存本番データの厳密移行（未リリース前提）

## 3. 受け入れ条件（テストに落とせる粒度）

1. `schema.prisma` の全モデル (`Message`, `Channel`, `Employee`, `Task`, `BatchRunLog`, `InvitationLink`, `User`) の `id` が `@default(uuid(7))`
2. `User` に `loginId String @unique` が存在し、FK 参照 (`Employee.userId` 等) は UUID 化後も整合
3. 認証: `POST /api/auth/login` に `{ loginId, password }` を送ると 200 が返る
4. 認証失敗: 存在しない `loginId` で 401、誤ったパスワードで 401
5. `LoginRequestSchema` が `loginId` フィールドを持つ
6. `AcceptInvitationSchema` が `loginId` フィールドを持つ
7. `POST /api/invitations/:token/accept` に `{ loginId, displayName, password }` を送ると 201 と AuthUser が返る
8. `loginId` 重複時は 409
9. `seedDevData` が `loginId: "testuser"` を user に投入する
10. `Channel` の Prisma リポジトリが `id` を明示指定せず DB default に委譲
11. Prisma マイグレーションが存在する
12. `pnpm test` / `pnpm lint` が全緑

## 4. 設計方針

### DB スキーマ
- Prisma 6 の `uuid(7)` をすべての `String @id` に付与
- `User`: サロゲートキー化。`loginId` を `@unique` で追加。既存行は `loginId = id` でマイグレーション

### 認証フロー
- `serializeUser`: `user.id`（UUID）をセッションキーとして使用（変更なし）
- `deserializeUser`: `findById(uuid)` で復元（変更なし）
- `LocalStrategy`: `usernameField: "loginId"` に変更し `findByLoginId` を使用

### データ型
```
User.id        → UUID (PK, auto-generated)
User.loginId   → human-readable login string (UNIQUE)
```

## 5. 影響範囲

- **common**: `auth.ts`, `invitation.ts`
- **server**: `schema.prisma`, マイグレーション, `userRepository.ts`, `prismaUserRepository.ts`, `passport.ts`, `seedDevData.ts`, `routes/invitations.ts`
- **client**: `LoginScene.tsx`, `AcceptInvitationScene.tsx`

## 6. テスト計画（TDD で書くテスト一覧）

1. `userRepository.ts` - `findByLoginId` が loginId で User を返す（InMemory）
2. `passport.ts` - `loginId` で認証が通る / 拒否される（auth.test.ts 更新）
3. `invitations.ts` - `loginId` を含むリクエストで accept が通る（invitations.test.ts 更新）
4. `seedDevData.test.ts` - `loginId: "testuser"` が投入される
5. `LoginScene.test.tsx` - loginSpy が `{ loginId, password }` で呼ばれる

## 7. リスク・未決事項

- `User.id` が "testuser" 等の人間可読文字列である既存の開発データは、マイグレーション後も `id` 値は変わらない（`@default` は新規行のみ）。テスト用インメモリ実装は後方互換のため `id: "testuser"` を維持。
- `PrismaChannelRepository.create` の `randomUUID()` を削除し DB default に委譲する。
