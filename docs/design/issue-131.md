# 設計書: 招待リンクの発行・管理 API とデータモデルを実装する（バックエンド基盤） (#131)

## 1. 目的 / 背景

管理者が招待リンクを発行し、期限 + single-use で安全に新規ユーザーを招待できる基盤を用意する。
後続 Issue (#132 受諾 API / #133 管理 UI / #134 受諾画面) が依存する API とデータモデルを本 Issue で整備する。

## 2. スコープ（やること / やらないこと）

**やること**
- `InvitationLink` Prisma モデルの追加とマイグレーション
- `common` への Zod スキーマ追加（`CreateInvitationSchema` / `InvitationSchema` / `InvitationStatusSchema`）
- ステータス導出純粋関数（`getInvitationStatus`）の実装（TDD）
- `InvitationLinkRepository` (interface / InMemory / Prisma 実装)
- 管理 API 3 本（`POST /admin/invitations` / `GET /admin/invitations` / `POST /admin/invitations/:id/revoke`）
- OpenAPI レジストリへの登録

**やらないこと**
- トークン検証・受諾・User 作成（#132 で対応）
- 管理 UI (#133)
- 受諾画面 (#134)
- メール送信

## 3. 受け入れ条件（テストに落とせる粒度で）

- `InvitationLink` モデルが Prisma スキーマに追加され、マイグレーションが作成されている
- `common` に `CreateInvitationSchema` / `InvitationSchema` / `InvitationStatusSchema` が追加され、全ユーザー入力文字列に `.max()` がある
- ステータス導出関数が `revoked > used > expired > active` の優先順位で正しく動作する（ユニットテスト緑）
- `InvitationLinkRepository` (interface / InMemory / Prisma) が実装されている
- `POST /admin/invitations` が認証必須で、`expiresInHours` から `expiresAt` を算出し推測困難な `token` を生成して 201 で返す
- `GET /admin/invitations` が一覧をステータス込みで返す
- `POST /admin/invitations/:id/revoke` で `revokedAt` がセットされ、以後ステータスが `revoked` になる
- 上記 3 エンドポイントが OpenAPI レジストリに登録されている
- 未認証アクセスが 401 になる
- レスポンスに `createdByUserId` が含まれない
- `turbo run lint test` が緑

## 4. 設計方針

### トークン保存方式の判断

**平文保存**を採用する（Issue 本文の方針どおり）。

- 管理画面でトークンを再コピーできる UX が重要
- 期限 + single-use でリスクを軽減
- ハッシュ保存だと一覧画面で URL を再表示できなくなるトレードオフ

### `InvitationLink` Prisma モデル

```prisma
model InvitationLink {
  id              String    @id @default(cuid())
  token           String    @unique
  expiresAt       DateTime
  usedAt          DateTime?
  usedByUserId    String?
  revokedAt       DateTime?
  createdByUserId String
  memo            String?
  createdAt       DateTime  @default(now())
}
```

### ステータス導出（優先順位）

1. `revokedAt != null` → `revoked`
2. `usedAt != null` → `used`
3. `expiresAt <= now` → `expired`
4. それ以外 → `active`

### `expiresInHours` の上限

`1` 〜 `720`（最長 30 日）。

### `memo` の上限

`200` 文字。

### API エンドポイント

- `POST /admin/invitations` — 201 + 発行直後の招待（token 含む）
- `GET /admin/invitations` — ステータス込みの一覧
- `POST /admin/invitations/:id/revoke` — 手動失効

## 5. 影響範囲

- `server/prisma/schema.prisma` — `InvitationLink` モデル追加
- `server/prisma/migrations/` — マイグレーションファイル追加
- `common/src/domain/invitation/` — 新規ドメインディレクトリ
- `common/src/index.ts` — エクスポート追加
- `server/src/persistence/invitationLinkRepository.ts` — 新規
- `server/src/persistence/prismaInvitationLinkRepository.ts` — 新規
- `server/src/routes/admin.ts` — 招待エンドポイント追加
- `server/src/app.ts` — `invitationLinkRepository` 配線追加
- `server/src/server.ts` — Prisma 実装注入追加
- `server/src/openapi/registry.ts` — 招待 API 登録

## 6. テスト計画

### common（純粋関数）
- `getInvitationStatus` のユニットテスト
  - `revokedAt` あり → `revoked`
  - `usedAt` あり (revoked なし) → `used`
  - `expiresAt` 過去 (revoked/used なし) → `expired`
  - 全て null/未来 → `active`
  - 優先順位: revokedAt + usedAt 両方あり → `revoked`

### server（API テスト、InMemory 使用）
- `POST /admin/invitations` — 201 + token/expiresAt を含む招待を返す
- `POST /admin/invitations` — 未認証で 401
- `GET /admin/invitations` — ステータス込みの一覧を返す
- `GET /admin/invitations` — 未認証で 401
- `POST /admin/invitations/:id/revoke` — revokedAt がセットされる
- `POST /admin/invitations/:id/revoke` — 存在しない id で 404
- `POST /admin/invitations/:id/revoke` — 未認証で 401
- レスポンスに `createdByUserId` が含まれない

## 7. リスク・未決事項

- Prisma マイグレーションはローカル DB がないため `migrate dev` は省略し、`migrate dev --create-only` で SQL ファイルだけ作成する（CI での `migrate deploy` で適用）
- `usedByUserId` の書き込みは #132 で行う（本 Issue ではフィールド定義のみ）
