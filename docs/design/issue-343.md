# 設計書: Google アカウントでログインできるようにする (#343)

## 1. 目的 / 背景

現行の認証は `passport-local`（ID/パスワード）のみ（ADR-0010）。v1.2.0 で公共コミュニティへの一般ユーザー受け入れが必要になり、パスワード登録なしでオンボーディングできる Google SSO を追加する。ADR-0010 の「将来 OAuth 等に移行する場合は Passport の Strategy を差し替えるだけで対応可能」という想定どおりの拡張。詳細は ADR-0027 に記録する。

## 2. スコープ（やること / やらないこと）

**やること:**
- `passport-google-oauth20` Strategy の追加
- `GET /api/auth/google` / `GET /api/auth/google/callback` エンドポイント
- `User.googleId String? @unique` の追加、`User.passwordHash` の nullable 化
- `UserRepository` に `findByGoogleId`・`create` への `googleId` 対応を追加
- 環境変数 `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_CALLBACK_URL` の追加
- Google 認証未設定時はエンドポイントを無効化（起動時エラーにしない）
- client の LoginScene に「Google でログイン」ボタン追加
- OpenAPI への登録

**やらないこと:**
- 既存 local アカウントと Google アカウントのメール統合（別 Issue）
- Google 以外の OAuth プロバイダ（別 Issue）
- セッションストアの Redis 化（別 Issue）

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. `GET /api/auth/google`（Google 認証設定あり）→ 302、Location に `accounts.google.com` が含まれる
2. `GET /api/auth/google`（Google 認証設定なし）→ 404
3. Google コールバック成功時 → `req.user` に AuthUser がセットされ `/` へリダイレクト
4. Google ユーザー作成時に `passwordHash` が null の User が作成される
5. Google ユーザーはパスワード認証（local strategy）を通過しない（passwordHash が null → 401）
6. 未認証で `GET /api/auth/me` → 401（既存）
7. `pnpm turbo run build test lint` 緑

## 4. 設計方針（アーキ・データ構造・主要モジュール）

### 4-1. 認証フロー

```
ブラウザ → GET /api/auth/google
→ passport.authenticate("google") → 302 accounts.google.com
→ Google 認証画面 → callback
→ GET /api/auth/google/callback
→ Strategy の verify(accessToken, refreshToken, profile, done)
  → userRepo.findByGoogleId(profile.id)
    → ヒット: done(null, toAuthUser(user))
    → ミス: userRepo.create({ loginId: `google_${googleId}`, displayName, googleId }) → done(null, toAuthUser(newUser))
→ セッション確立 → 302 /
```

### 4-2. Google 設定の有効/無効

`AppDeps.googleAuth?: { clientId: string; clientSecret: string; callbackUrl: string }`

- 設定あり → `createPassport` に Google Strategy を登録、`createAuthRouter` に `/google` / `/google/callback` ルートを追加
- 設定なし → Strategy 未登録・ルート未追加（404 になる）

本番は `server/src/server.ts` が `env.ts` から `GoogleAuthConfig` を組み立てて渡す。

### 4-3. スキーマ変更

```prisma
model User {
  id           String    @id @default(uuid(7))
  loginId      String    @unique
  displayName  String
  passwordHash String?   // Google ユーザーは null
  avatarUrl    String?
  role         UserRole  @default(member)
  googleId     String?   @unique  // Google OAuth の sub claim
  subscriptions Subscription[]
  votes        Vote[]
}
```

### 4-4. UserRepository 拡張

```typescript
export interface UserRepository {
  // 既存
  findById(id: string): Promise<User | null>;
  findByLoginId(loginId: string): Promise<User | null>;
  updateProfile(...): Promise<User>;
  create(input: { loginId: string; displayName: string; passwordHash?: string | null; googleId?: string | null }): Promise<User>;
  // 追加
  findByGoogleId(googleId: string): Promise<User | null>;
}
```

## 5. 影響範囲 / 既存への変更

| ファイル | 変更内容 |
|----------|---------|
| `server/prisma/schema.prisma` | `User.googleId` 追加、`passwordHash` nullable 化 |
| `server/prisma/migrations/*` | 新マイグレーション SQL（手動作成） |
| `server/src/persistence/userRepository.ts` | `User` 型・`UserRepository` IF 拡張 |
| `server/src/persistence/prismaUserRepository.ts` | `findByGoogleId`・`create` 対応 |
| `server/src/auth/passport.ts` | Google Strategy 追加・null passwordHash ガード |
| `server/src/app.ts` | `AppDeps.googleAuth?` 追加 |
| `server/src/routes/auth.ts` | Google OAuth ルート追加 |
| `server/src/openapi/registry.ts` | Google auth エンドポイント登録 |
| `server/src/config/env.ts` | Google 環境変数追加 |
| `server/src/server.ts` | env から GoogleAuthConfig を組み立て |
| `client/src/routes/LoginScene.tsx` | Google ログインボタン追加 |
| `docs/adr/0027-google-oauth.md` | 新 ADR |
| `docs/adr/README.md` | 一覧に 0027 追加 |

## 6. テスト計画（TDDで書くテスト一覧）

### server/src/routes/auth.test.ts（追加）

- `GET /api/auth/google`（設定あり）→ 302、Location に `accounts.google.com`
- `GET /api/auth/google`（設定なし）→ 404
- ローカル認証で googleId のみのユーザー（passwordHash=null）→ 401

### server/src/persistence/userRepository.test.ts（存在すれば追加）

- `findByGoogleId` でヒット / ミスの挙動
- `create` で googleId あり / passwordHash null のユーザー作成

## 7. リスク・未決事項

- **`prisma migrate dev` は DB 接続が必要**: 本 PR では手動で migration SQL を作成する。本番適用は `prisma migrate deploy` で実行。
- **Google Strategy の verify は実 API を呼ばない**: テストではモックせず、dummy 資格情報でのリダイレクトのみ確認する。
- **loginId の衝突**: `google_${googleId}` が既存 loginId と衝突する可能性は理論上ゼロ（googleId は数値 ID で通常 `google_` prefix のアカウントは存在しない）。
