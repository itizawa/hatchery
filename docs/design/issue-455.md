# 設計書: 認証を Google ログインのみに統一し招待制を廃止する (#455)

## 1. 目的 / 背景

現在 ID/パスワード認証（passport-local）と Google OAuth が共存している。ADR-0027 の「後方互換維持」決定を覆し、Google ログインのみの構成へ移行する。あわせて招待制を廃止し、Google 初回ログイン時に誰でも自動でアカウントを生成する。

## 2. スコープ（やること / やらないこと）

**やること**
- ADR-0027 を Superseded とし ADR-0029 を起こす
- `passport-local` Strategy と `POST /api/auth/login` を削除
- 招待制（`InvitationLink` テーブル・関連 API・client UI）を全廃
- Prisma: `User` から `loginId`, `passwordHash` を削除; `email String @unique` (NOT NULL)・`googleId String @unique` (NOT NULL) を必須化
- `common/AuthUserSchema` から `loginId` を除去し `email` を追加
- `LoginRequestSchema` / `AcceptInvitationSchema` を削除
- `client/LoginScene.tsx` を「Google でログイン」ボタンのみに簡略化
- 開発専用バイパスログイン `POST /api/auth/dev-login` を実装（`NODE_ENV !== 'production'` 限定）
- `seedDevData.ts` を Google 前提の dev ユーザー（googleId + email）で再作成

**やらないこと**
- 既存本番ユーザーのデータ移行（本番は未昇格のため対象外）
- Google 以外の IdP 追加
- メール認証・退会フロー

## 3. 受け入れ条件（テストに落とせる粒度）

1. `AuthUserSchema` が `loginId` フィールドを持たず `email: z.string().email().max(254)` を持つ
2. `LoginRequestSchema` が common のエクスポートに存在しない
3. `createPassport` に LocalStrategy が含まれない（`passport-local` を使わない）
4. `toAuthUser(user)` が `email` を含み `loginId` を含まない
5. `POST /api/auth/login` が存在しない（404）
6. `POST /api/auth/dev-login` は `NODE_ENV !== 'production'` のとき 200 を返す
7. `POST /api/auth/dev-login` は `NODE_ENV === 'production'` のとき 404 を返す
8. Google 初回ログイン時に `email` が設定された User が自動生成される
9. `pnpm turbo run build` / `pnpm turbo run test` / `pnpm turbo run lint` / `pnpm typecheck` が全緑

## 4. 設計方針

### DB再設計

```prisma
model User {
  id            String         @id @default(uuid(7))
  email         String         @unique         // Google プロフィールの email（必須）
  googleId      String         @unique         // OAuth sub claim（必須）
  displayName   String
  avatarUrl     String?
  role          UserRole       @default(member)
  subscriptions Subscription[]
  votes         Vote[]
}
```

migration: `loginId`, `passwordHash` DROP, `email` ADD NOT NULL, `googleId` NOT NULL化, `InvitationLink` テーブル DROP

### UserRepository インターフェース変更

```typescript
export interface User {
  id: string;
  email: string;       // 追加（NOT NULL）
  googleId: string;    // NOT NULL化（string | null → string）
  displayName: string;
  role: UserRole;
  avatarUrl: string | null;
}

export interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByGoogleId(googleId: string): Promise<User | null>;
  updateProfile(id: string, data: { displayName: string; avatarUrl?: string }): Promise<User>;
  create(input: { email: string; googleId: string; displayName: string; googleIdAlreadyExists?: false }): Promise<User>;
}
```

`findByLoginId` は削除、`LoginIdAlreadyExistsError` は `GoogleIdAlreadyExistsError` に置換。

### passport.ts 変更

- `LocalStrategy` ブロックを丸ごと削除
- `toAuthUser()` で `loginId` の代わりに `email` をマッピング
- Google Strategy の自動登録ロジックで `email = profile.emails?.[0]?.value` を取得し `create({ email, googleId, displayName })` を呼ぶ

### dev-login エンドポイント

```typescript
// NODE_ENV !== 'production' のときのみ router に追加
router.post("/dev-login", async (req, res, next) => {
  const devUser = await userRepository.findByGoogleId("dev-google-id");
  if (!devUser) { res.status(404).json({ error: "Dev user not found" }); return; }
  req.login(toAuthUser(devUser), (err) => {
    if (err) return next(err);
    res.status(200).json(toAuthUser(devUser));
  });
});
```

`seedDevData.ts` の dev ユーザーを `{ googleId: "dev-google-id", email: "dev@hatchery.local", displayName: "claude-dev", role: "admin" }` で作成。

### common スキーマ変更

`auth.ts`:
- `LoginRequestSchema`, `LoginRequest`, `LOGIN_ID_MAX_LENGTH`, `PASSWORD_MAX_LENGTH` を削除
- `AuthUserSchema` から `loginId` を除去し `email: z.string().email().max(254)` を追加
- `EMAIL_MAX_LENGTH = 254` 定数を追加

`invitation/invitation.ts`:
- `AcceptInvitationSchema`, `AcceptInvitation`, `ACCEPT_INVITATION_*` 定数を削除
- 招待関連は全廃（CreateInvitationSchema, InvitationStatusSchema 含む）

### client 変更

- `LoginScene.tsx`: useForm 全削除、「Google でログイン」ボタンのみ残す
- `api/auth.ts`: `login()`, `useLogin()` を削除
- `AcceptInvitationScene.tsx` / `AcceptInvitationScene.test.tsx` を削除
- `router.tsx` から accept-invitation ルートを削除
- `InvitationsTab.tsx` / `api/invitations.ts` を削除
- `SettingsScene.tsx` から invitations タブを除去

## 5. 影響範囲

| ワークスペース | 変更 |
|---|---|
| common | auth.ts, invitation/invitation.ts, バレルエクスポート |
| server | passport.ts, auth.ts, invitations.ts(削除), admin.ts, app.ts, composition, userRepository, prismaUserRepository, prismaInvitationLinkRepository(削除), openapi/registry.ts, seedDevData.ts, migration |
| client | LoginScene.tsx, AcceptInvitationScene.tsx(削除), router.tsx, api/auth.ts, api/invitations.ts(削除), InvitationsTab.tsx(削除), SettingsScene.tsx |

## 6. テスト計画

| テスト | 検証内容 |
|---|---|
| `common/src/domain/auth/auth.test.ts` | AuthUserSchema が email を含む / loginId を含まない |
| `server/src/auth/passport.test.ts` | toAuthUser が email を返す / LocalStrategy が存在しない |
| `server/src/routes/auth.test.ts` | POST /login → 404, dev-login → dev で 200 / prod で 404 |
| 既存テスト更新 | passport.test.ts, invitations.test.ts(削除), LoginScene.test.tsx |

## 7. リスク・未決事項

- 開発環境で seed が走っていないと dev-login が 404 になる（seed を事前実行するドキュメントを README に追記が理想だが本 Issue のスコープ外）
- `google_<googleId>` 形式の loginId を持つ既存ユーザーは、DB マイグレーション後に googleId + email が設定されていれば問題ない（develop は未本番昇格のため破壊的移行を許容）
