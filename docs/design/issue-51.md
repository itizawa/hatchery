# 設計書: アカウント設定画面で自分自身の情報を更新できる (#51)

## 1. 目的 / 背景

#50 で新設したアカウント設定画面（`/account`）に「プロフィール編集」フォームを実装する。
ログインユーザー自身の `displayName`（表示名）とプロフィール画像 URL（`avatarUrl`）を更新できるようにし、
server 側に `PATCH /auth/me` エンドポイントを合わせて実装する。

## 2. スコープ（やること / やらないこと）

### やること
- `User` モデルに `avatarUrl`（nullable String）を追加し Prisma マイグレーション
- `common` に `UpdateProfileSchema`（PATCH リクエストボディ用 Zod スキーマ）を追加
- `common` の `AuthUserSchema` に `avatarUrl`（optional）を追加
- `server` の `UserRepository` に `updateProfile` メソッドを追加
- `PATCH /auth/me` エンドポイントを実装（認証必須、Zod 検証）
- `client` の `AccountScene` にプロフィール編集フォームを実装
- OpenAPI スキーマに `PATCH /auth/me` を定義

### やらないこと
- ファイルアップロード（avatarUrl は URL 文字列のみ受け付ける）
- パスワード変更
- アバター画像のプレビュー表示

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

### DB / Prisma
- `User` モデルに `avatarUrl`（`String?`、nullable）が追加されている
- Prisma マイグレーションが生成・適用できる

### server
- `PATCH /auth/me` に未ログインでアクセスすると 401 が返る
- `displayName`（1文字以上）を送ると 200 で更新後のユーザー情報が返る
- `displayName` が空文字列の場合は 400 Bad Request が返る
- `avatarUrl` が不正な URL 形式の場合は 400 が返る
- `avatarUrl` を省略しても更新できる（省略時は既存値を維持）
- レスポンスに `passwordHash` は含まれない

### client（単体テスト）
- displayName が空のとき保存ボタンが無効化される
- 保存ボタン押下で `PATCH /auth/me` が呼ばれる
- 保存成功時にスナックバー（成功通知）が表示される

## 4. 設計方針

### アーキテクチャ・データ構造

**common:**
```typescript
// 追加: PATCH /auth/me リクエストボディ
export const UpdateProfileSchema = z.object({
  displayName: z.string().min(1),
  avatarUrl: z.string().url().optional(),
});
export type UpdateProfile = z.infer<typeof UpdateProfileSchema>;

// 変更: avatarUrl を optional で追加
export const AuthUserSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  employeeId: z.string().optional(),
  avatarUrl: z.string().optional(),
});
```

**server/persistence/userRepository:**
```typescript
export interface User {
  id: string;
  displayName: string;
  passwordHash: string;
  employeeId: string | null;
  avatarUrl: string | null; // 追加
}

export interface UserRepository {
  findById(id: string): Promise<User | null>;
  updateProfile(id: string, data: { displayName: string; avatarUrl?: string }): Promise<User>; // 追加
}
```

**server/routes/auth.ts:**
- `createAuthRouter(passportInstance, userRepository)` にシグネチャを変更
- `PATCH /auth/me` → `requireAuth` + `validateBody(UpdateProfileSchema)` → `userRepository.updateProfile`
- 更新後、`toAuthUser()` で整形した AuthUser を 200 で返す

**client:**
- `AccountScene.tsx`: MUI の `TextField`・`Button`・`Snackbar`・`Alert` を使用
- `useAuth()` フックで現在値を初期値に設定
- `useUpdateProfile()` ミューテーションを追加（成功後に `AUTH_ME_QUERY_KEY` を invalidate）

### 主要モジュール
- `common/src/domain/auth/auth.ts` — UpdateProfileSchema 追加、AuthUserSchema 変更
- `server/src/persistence/userRepository.ts` — User 型・UserRepository IF 変更
- `server/src/persistence/prismaUserRepository.ts` — updateProfile 実装
- `server/src/auth/passport.ts` — toAuthUser に avatarUrl 追加
- `server/src/routes/auth.ts` — PATCH /auth/me 追加
- `server/src/app.ts` — createAuthRouter 呼び出し変更
- `server/src/openapi/registry.ts` — PATCH /auth/me 登録
- `server/prisma/schema.prisma` — User.avatarUrl 追加
- `client/src/api/auth.ts` — useUpdateProfile 追加
- `client/src/routes/AccountScene.tsx` — プロフィール編集フォーム

## 5. 影響範囲

- `common`: AuthUserSchema（既存型拡張・後方互換あり）
- `server`: auth ルータのシグネチャ変更（app.ts の呼び出し箇所のみ）
- `client`: AccountScene（シェルからフォームへの拡張）
- `docs`: OpenAPI スキーマに PATCH /auth/me 追加

## 6. テスト計画（TDD で書くテスト一覧）

1. `common/src/domain/auth/auth.test.ts`
   - UpdateProfileSchema: 正常系（displayName のみ、displayName + avatarUrl）
   - UpdateProfileSchema: 異常系（displayName 空、avatarUrl 不正 URL）

2. `server/src/routes/auth.test.ts`
   - PATCH /auth/me: 未認証 → 401
   - PATCH /auth/me: 認証済み + 正常ボディ → 200 + 更新後ユーザー
   - PATCH /auth/me: displayName 空 → 400
   - PATCH /auth/me: avatarUrl 不正 URL → 400
   - PATCH /auth/me: avatarUrl 省略でも更新可 → 200
   - PATCH /auth/me: レスポンスに passwordHash が含まれない

3. `client/src/routes/AccountScene.test.tsx`
   - displayName 空でボタン無効化
   - 保存ボタン押下で PATCH 呼び出し
   - 保存成功でスナックバー表示

## 7. リスク・未決事項

- `avatarUrl` の URL 検証は Zod の `.url()` を使用（ブラウザ外では`URL`コンストラクタ相当の検証）
- `PATCH /auth/me` で更新後、セッションの `req.user` は次のデシリアライズ（次リクエスト）で自動反映される
- Prisma マイグレーションは dev 環境でのみ自動適用（本番は `prisma migrate deploy` を別途実行）
