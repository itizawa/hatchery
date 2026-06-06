# 設計書: 招待リンクによる新規ユーザー登録 API（検証・受諾・User 作成） (#132)

## 1. 目的 / 背景

#131 で招待リンクの発行・管理 API とデータモデルが完成した。本 Issue はその招待リンクを使って新規ユーザーが登録（受諾）できる公開 API を実装する。

- トークンの有効性を確認できる（期限切れ・使用済み・失効済みは弾く）
- リンクから新規 User を作成して登録を完了できる
- 一度使ったら失効する（single-use）

## 2. スコープ（やること / やらないこと）

### やること
- `AcceptInvitationSchema` / `InvitationPublicSchema` を `common` に追加
- `UserRepository.create` を追加（interface / InMemory / Prisma）
- `InvitationLinkRepository.markUsed` を追加（条件付き更新 / interface / InMemory / Prisma）
- 公開ルート `GET /invitations/:token` — トークン検証
- 公開ルート `POST /invitations/:token/accept` — 受諾・User 作成・自動ログイン
- OpenAPI レジストリ登録

### やらないこと
- 招待の発行・管理 UI（#133）
- 受諾（新規登録）画面（#134）
- メール送信

## 3. 受け入れ条件（テストに落とせる粒度）

- `AcceptInvitationSchema` — `id(min1,max50)` / `displayName(min1,max100)` / `password(min8,max100)` — 全 `.max()` あり
- `InvitationPublicSchema` — `status` / `expiresAt` のみ（機微情報なし）
- `UserRepository.create` が追加され `id` 重複時にドメインエラー
- `GET /invitations/:token` — 存在しない token → 404、存在すれば 200 + status
- `POST /invitations/:token/accept` — active な招待のみ User 作成 + セッション確立 + 201 + AuthUser
- `POST /invitations/:token/accept` — 期限切れ・使用済み・失効済み → 409
- `POST /invitations/:token/accept` — id 重複 → 409（`usedAt` は立たない）
- 同じ token への 2 回目 accept → 409（single-use 保証）
- User 作成と `markUsed` が atomic（InMemory では check+update で擬似保証）
- 受諾成功後 `GET /auth/me` が新ユーザーを返す
- レスポンスに `passwordHash` 等の内部情報が漏れない

## 4. 設計方針

### AcceptInvitationSchema（common）
```
id: z.string().min(1).max(50)       # ログインID
displayName: z.string().min(1).max(100)
password: z.string().min(8).max(100)
```

### InvitationPublicSchema（common）
機微情報を出さない。`status` と `expiresAt` のみ返す（token は URL にあるので不要）。
```
status: InvitationStatusSchema
expiresAt: z.coerce.date()
```

### UserRepository.create
```typescript
create(input: { id: string; displayName: string; passwordHash: string }): Promise<User>
```
- `id` 重複時は `UserIdAlreadyExistsError`（extends Error）をスロー

### InvitationLinkRepository.markUsed
```typescript
markUsed(id: string, usedByUserId: string): Promise<InvitationLinkRecord | null>
```
- 条件: `usedAt IS NULL AND revokedAt IS NULL AND expiresAt > now`
- 条件を満たさない場合は `null` を返す（既に使用済み・失効・期限切れ）
- Prisma 実装: `updateMany` で条件付き更新 + カウント確認
- InMemory 実装: check → update（テスト用。同時並行は想定しない）

### acceptInvitation ユースケース（routes 内インライン or usecase ファイル）
1. `findByToken` → 404
2. `getInvitationStatus` → active 以外 → 409
3. `findById(id)` → 重複 → 409（usedAt は立てない）
4. bcrypt.hash(password)
5. `create(user)` → 重複時 409（usedAt は立てない）
6. `markUsed(invitationId, userId)` → null なら 409（同時リクエスト競合）
7. `req.login` でセッション確立 → 201 + AuthUser

### HTTP ステータス方針
- 存在しない token: 404
- active 以外（expired/used/revoked）: 409（Conflict / Already Used / Expired）
- id 重複: 409
- 成功: 201

## 5. 影響範囲

- `common/src/domain/invitation/invitation.ts` — スキーマ追加
- `server/src/persistence/userRepository.ts` — interface + InMemory に `create` 追加
- `server/src/persistence/prismaUserRepository.ts` — `create` 追加
- `server/src/persistence/invitationLinkRepository.ts` — interface + InMemory に `markUsed` 追加
- `server/src/persistence/prismaInvitationLinkRepository.ts` — `markUsed` 追加
- `server/src/routes/invitations.ts` — 新規作成（公開ルート）
- `server/src/app.ts` — `/invitations` ルーター追加
- `server/src/openapi/registry.ts` — 2 エンドポイント登録

## 6. テスト計画（TDD で書くテスト一覧）

### common（invitation.test.ts に追記）
- `AcceptInvitationSchema` のバリデーション（各フィールドの min/max）

### server/routes/invitations.test.ts（公開エンドポイント）
- `GET /invitations/:token` — 存在しない token → 404
- `GET /invitations/:token` — active token → 200 + status
- `GET /invitations/:token` — 期限切れ → 200 + status: expired
- `POST /invitations/:token/accept` — 未登録 token → 404
- `POST /invitations/:token/accept` — active → 201 + AuthUser
- `POST /invitations/:token/accept` — 成功後 `GET /auth/me` → 新ユーザー
- `POST /invitations/:token/accept` — 2 回目 accept → 409
- `POST /invitations/:token/accept` — 期限切れ → 409
- `POST /invitations/:token/accept` — 使用済み → 409
- `POST /invitations/:token/accept` — 失効済み → 409
- `POST /invitations/:token/accept` — id 重複 → 409（`usedAt` 立たない）
- `POST /invitations/:token/accept` — バリデーションエラー（password 短すぎ）→ 400
- レスポンスに `passwordHash` が含まれない

## 7. リスク・未決事項

- bcrypt の非同期処理: 既存実装（auth.ts / InMemoryUserRepository.createWithTestUser）と同様の SALT_ROUNDS を使用
- Prisma の条件付き更新（`updateMany` + count）: transactionを使わずとも atomic に `usedAt IS NULL` 条件で 1 回のみ更新できる
