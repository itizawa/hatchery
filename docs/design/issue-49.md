# 設計書: ログインユーザーにEmployeeを紐付ける (#49)

## 1. 目的 / 背景

Hatchery ではログインユーザー自身も「社員」として会話に参加できる（#48 メッセージ作成）。
そのため User と Employee を 1:1 で関連付け、メッセージ投稿時に「自分の Employee」として
発言できるようにする。AI 社員にはユーザー所有の Employee と区別するため `isBot=true` を設定する。

## 2. スコープ（やること / やらないこと）

### やること
- `Employee` モデルに `isBot`（既定 false）・`userId`（任意・`@unique`）を追加し、`User` との 1:1 任意リレーションを定義する。
- 追加列のための Prisma マイグレーション SQL を作成する。
- common `EmployeeSchema` に `isBot`（`z.boolean().default(false)`）を追加する。
- seed で AI 社員 3 名を `isBot=true / userId=null`、ログインユーザーの Employee を `isBot=false / userId=<user.id>` で生成する。
- `GET /auth/me` のレスポンスに自身の `employeeId` を含める（User ↔ Employee を JOIN）。
- OpenAPI スキーマ（`AuthUser`）を更新する。

### やらないこと
- メッセージ投稿時に `req.user.employeeId` を `speaker` として使う処理は #48 の範囲（本 Issue では型・データの土台のみ）。
- ユーザーが Employee を新規作成・編集する UI / API。
- 経験値・関係値などの拡張（MVP 外）。

## 3. 受け入れ条件（テストに落とせる粒度）

### DB / Prisma
- AC-1: `schema.prisma` の `Employee` に `isBot Boolean @default(false)` がある。
- AC-2: `schema.prisma` の `Employee` に `userId String? @unique` と `User` への任意リレーションがある（`User` 側に逆リレーション）。
- AC-3: 追加列のマイグレーション SQL が存在し、`isBot` 列・`userId` 列・`userId` の一意インデックス・外部キーを定義する。

### common
- AC-4: `EmployeeSchema.parse({ id, displayName })` の結果に `isBot === false` が含まれる（既定値）。
- AC-5: `EmployeeSchema.parse({ id, displayName, isBot: true })` の結果に `isBot === true` が含まれる。
- AC-6: `Employee` 型に `isBot` が含まれる（型レベル。`z.infer`（output）由来のため `isBot: boolean` 必須）。
- AC-7: `DEFAULT_EMPLOYEES`（AI 社員 3 名）はすべて `isBot === true`。
- AC-8: `AuthUserSchema` に `employeeId`（`z.string().optional()`）が含まれ、省略しても付与してもパース成功する。

### server
- AC-9: 認証済みかつ Employee が紐づくユーザーで `GET /auth/me` を呼ぶと、レスポンスに `employeeId` が含まれる。
- AC-10: Employee が紐づかないユーザーでは `employeeId` を含めない（`AuthUser` の任意フィールド）。
- AC-11: OpenAPI ドキュメントの `AuthUser` スキーマに `employeeId` が含まれる（`AuthUserSchema` から自動生成されることを確認）。

### seed
- AC-12: seed は AI 社員 3 名（`DEFAULT_EMPLOYEES`）を `isBot=true / userId=null` で upsert し、ログインユーザーの Employee を `isBot=false / userId=<user.id>` で upsert する（実行検証は #42 連携／DB 必須のため CI 外）。

### テスト / 品質
- AC-13: `turbo run lint test` が緑（CI: Node 26）。

## 4. 設計方針

### Prisma（server/prisma/schema.prisma）
```prisma
model User {
  id           String    @id
  displayName  String
  passwordHash String
  employee     Employee?            // 1:1 逆リレーション
}

model Employee {
  id          String            @id
  displayName String
  role        String?
  isBot       Boolean           @default(false)
  userId      String?           @unique           // 1 ユーザー = 1 Employee
  user        User?             @relation(fields: [userId], references: [id])
  tasks       Task[]
  channels    ChannelEmployee[]
}
```
マイグレーション SQL は既存ファイルの手書きスタイルに合わせ、`ALTER TABLE`＋一意インデックス＋FK で記述する。

### common（EmployeeSchema）
`isBot: z.boolean().default(false)` を追加する。エクスポートする `Employee` 型は **`z.infer`（output / parse 後）** から導出し、
`isBot` は常に `boolean`（必須）とする。`.default(false)` により `parse` 後は必ず `boolean` が埋まるため、
bot 判定（#48 で利用）を型安全に扱える。`DEFAULT_EMPLOYEES` は AI 社員なので各要素に `isBot: true` を明示する。

### server（/auth/me に employeeId）
`req.user` は passport の login Strategy / `deserializeUser` が構築する。User ↔ Employee の JOIN は
永続化層に閉じ込める:
- `UserRepository` の `User` に `employeeId: string | null` を追加（紐づく Employee の id、無ければ null）。
- `PrismaUserRepository.findById` は `include: { employee: { select: { id: true } } }` で JOIN し `employeeId` を詰める。
- passport は `{ id, displayName }` に、`employeeId` があれば付与して `req.user` を構築する（null/未紐づけのときは付与しない）。
- common `AuthUserSchema` に `employeeId: z.string().optional()` を追加 → `AuthUserComponent` 経由で OpenAPI も自動更新。

### seed（server/prisma/seedDevData.ts。#42 で投入ロジックは seedDevData に集約済み）
#42 が `seedDevData.ts`（DB 非依存の構造的 `SeedPrisma` 型でユニットテスト可能）に投入ロジックを集約した。
そこへ #49 を統合する: common の `DEFAULT_EMPLOYEES` を単一情報源に AI 社員を `isBot=true / userId=null` で upsert し、
ログインユーザー（`testuser`）に対応する Employee（`emp-testuser`）を `isBot=false / userId=testuser` で upsert する。

## 5. 影響範囲 / 既存への変更

- **common**: `domain/employee/employee.ts`（EmployeeSchema / 型 / DEFAULT_EMPLOYEES）、`domain/auth/auth.ts`（AuthUserSchema）。
- **server**: `prisma/schema.prisma`、新規マイグレーション、`persistence/userRepository.ts`（User 型 / InMemory）、`persistence/prismaUserRepository.ts`、`auth/passport.ts`、`prisma/seedDevData.ts`（#42 で集約された投入ロジックへ isBot / userId 紐付けを統合）。
- **client**: 変更なし（OpenAPI 由来の生成型に `employeeId?` が増えるのみ。`AuthUser` 利用箇所は後方互換）。
- **docs**: 本設計書。

## 6. テスト計画（TDD）

- common `employee.test.ts`: AC-4（既定 false）、AC-5（明示 true）、AC-7（DEFAULT_EMPLOYEES は全員 isBot true）。
- common `auth.test.ts`: AC-8（AuthUserSchema の employeeId 任意）。
- server `prisma/schema` のテキスト検証テスト: AC-1〜AC-3（DB 不要で CI 実行可。schema.prisma / マイグレーション SQL に必要な定義があること）。
- server `auth.test.ts`: AC-9（employeeId が返る）、AC-10（紐づかないユーザーでは含まれない）。
- server `openapi/registry.test.ts`: AC-11（生成ドキュメントの AuthUser に employeeId）。
- AC-12（seed）は `seedDevData.test.ts`（#42 の fake prisma を拡張し isBot / userId を記録）で AI 社員 isBot=true・ユーザー社員 isBot=false/userId 紐付けを DB 非依存に検証（CI 実行可）。加えて DB 必須の統合テスト（`describe.skipIf(!DATABASE_URL)`）で isBot 既定・userId 一意 1:1 を検証（CI スキップ）。

## 7. リスク・未決事項

- **`dev-user` vs `testuser`**: Issue 本文はログインユーザー id を `dev-user` と記載するが、既存 seed / 認証（#26）は `testuser`（`testuser`/`testpass`）を単一の開発ユーザーとして用いている。新規に紐づけ先のない `dev-user` を作るとログインできない Employee が生じるため、**実在する `testuser` に紐づける**。`dev-user` は本文の例示と解釈する。
- **ローカル検証環境**: 当コンテナの Node は 22（リポジトリは Node 26 前提）。`engine-strict` を無効化して依存を導入しローカル検証する。最終的なマージ判定は Node 26 で走る CI を正本とする。
- **Prisma マイグレーションの適用**: DB が無いため適用検証は不可。SQL は既存マイグレーションのスタイルに合わせて手書きし、適用は #42/運用側に委ねる（CI も migrate を実行しない）。
