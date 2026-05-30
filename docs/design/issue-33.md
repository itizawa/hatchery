# 設計書: チャンネルへの Employee 所属機能（多対多・認証必須） (#33)

## 1. 目的 / 背景

Employee をチャンネルに所属させる仕組みを実装する。チャンネルに所属している Employee のみが、
そのチャンネルでメッセージ生成（#32 の定時バッチ）の発言候補となる。

Employee とチャンネルは **多対多**（1 人の Employee が複数チャンネルに所属可能）。
チャンネルへの Employee の追加・除外は **ログイン済みユーザーのみ** 実行できる。

## 2. スコープ（やること / やらないこと）

### やること

- Prisma に Employee ↔ Channel の多対多リレーション（明示的中間テーブル `ChannelEmployee`）を定義し migration を追加。
- 永続化境界（ポート）`ChannelMembershipRepository` と InMemory / Prisma 実装。
- ユースケース（追加 / 除外）と `/channels/:channelId/employees` ルータ。
  - `POST /channels/:channelId/employees`（認証必須）: Employee を追加。
  - `DELETE /channels/:channelId/employees/:employeeId`（認証必須）: Employee を除外。
  - `GET /channels/:channelId/employees`（認証不要）: 所属 Employee の id 一覧（状態確認・バッチ連携の素材）。
- 追加・除外 API の認証ガード（`requireAuth`）。未ログインは 401。
- OpenAPI registry に 3 エンドポイントを登録。
- 定時バッチ（#32）が「対象チャンネルに所属する Employee のみ」を発言候補とするよう、
  common の `buildRosterMessages` に**任意の所属マップ**を渡せるよう拡張し、generator / バッチ CLI を連携。

### やらないこと

- Employee / Channel 自体の CRUD（#47 / 別 Issue）。本 Issue は所属関係に限定。
- AI によるメッセージ生成（#53）。バッチ連携は既存の静的テンプレート生成器に対して行う。
- 所属に伴う権限・ロールの拡張（MVP 外）。

## 3. 受け入れ条件（テストに落とせる粒度）

- [ ] Employee ↔ Channel の多対多リレーション（中間テーブル `ChannelEmployee`）が Prisma スキーマと migration に定義される。
- [ ] 1 人の Employee が複数チャンネルに所属できる（repository テストで検証）。
- [ ] 1 つのチャンネルに複数 Employee が所属できる（repository テストで検証）。
- [ ] `POST /channels/:channelId/employees` で所属を追加できる（認証済み → 201、所属が反映される）。
- [ ] `DELETE /channels/:channelId/employees/:employeeId` で所属を除外できる（認証済み → 204、所属から消える）。
- [ ] 追加 / 除外 API は未ログインだと 401 を返す。
- [ ] 追加 API のボディ `employeeId` が空なら 400（common の Zod スキーマ検証）。
- [ ] 同じ所属を重複追加してもエラーにならない（冪等）。
- [ ] 定時バッチは、所属マップを渡したとき、各チャンネルで所属 Employee のみを発言候補にする（未所属は発言しない）。

## 4. 設計方針（アーキ・データ構造・主要モジュール）

層分離（ADR-0004）と依存方向（client/server → common 一方向、ADR-0005）に従う。

### common（純粋・単一情報源）

- `common/src/domain/channelMembership/channelMembership.ts`
  - `AddChannelMemberSchema = z.object({ employeeId: z.string().min(1) })` … POST のリクエストボディ検証。
  - `ChannelMembershipSchema = z.object({ channelId: z.string().min(1), employeeId: z.string().min(1) })` … 所属 1 件の表現。
  - 型 `AddChannelMember` / `ChannelMembership` を `z.infer` でエクスポート。
- `common/src/logic/buildRosterMessages.ts` を後方互換に拡張:
  - 入力に任意の `membershipByChannel?: Readonly<Record<string, readonly string[]>>` を追加。
  - 指定時は各チャンネルの発言候補を「そのチャンネルに所属する Employee」に絞る（未指定なら従来どおり全 Employee）。

### server（層分離）

- 永続化: `server/src/persistence/channelMembershipRepository.ts`（ポート + `InMemoryChannelMembershipRepository`）、
  `prismaChannelMembershipRepository.ts`（Prisma 実装）。
  - `addMember(channelId, employeeId)` … 冪等（既存なら何もしない）。
  - `removeMember(channelId, employeeId)`。
  - `listEmployeeIdsByChannel(channelId): Promise<string[]>`。
  - `listChannelIdsByEmployee(employeeId): Promise<string[]>`（多対多の検証用）。
  - `listMembershipByChannel(): Promise<Record<string, string[]>>`（バッチ連携用の所属マップ）。
- ユースケース: `server/src/usecases/channelMembers.ts`（`addChannelMember` / `removeChannelMember`）。
- ルート: `server/src/routes/channels.ts`（`createChannelsRouter`）。追加 / 除外は `requireAuth`、追加は `validateBody(AddChannelMemberSchema)`。
- `createApp` の `AppDeps` に `channelMembershipRepository?`（省略時 InMemory）を追加し `/channels` をマウント。
- OpenAPI: `registry.ts` に 3 パスを登録。
- バッチ: `createRosterMessageGenerator` に任意の `membershipByChannel` を追加し `buildRosterMessages` へ転送。
  `batch/index.ts` で `PrismaChannelMembershipRepository.listMembershipByChannel()` を取得して generator に渡す。

### Prisma スキーマ

```prisma
model ChannelEmployee {
  channelId  String
  employeeId String
  channel    Channel  @relation(fields: [channelId], references: [id], onDelete: Cascade)
  employee   Employee @relation(fields: [employeeId], references: [id], onDelete: Cascade)
  @@id([channelId, employeeId])
  @@index([employeeId])
}
```

Channel / Employee に逆リレーション `members ChannelEmployee[]` / `channels ChannelEmployee[]` を追加。

## 5. 影響範囲 / 既存への変更

- **common**: `domain/channelMembership/` 追加、`index.ts` でエクスポート、`logic/buildRosterMessages.ts` を後方互換拡張。
- **server**: persistence / usecases / routes 追加、`app.ts` に DI とマウント追加、`openapi/registry.ts` 追加登録、
  `batch/rosterMessageGenerator.ts` / `batch/index.ts` の連携、Prisma スキーマ + migration。
- **client / docs**: 変更なし。
- 既存テストは変更しない（拡張は後方互換・新規テストファイルで検証）。

## 6. テスト計画（TDD で書くテスト一覧）

- common
  - `domain/channelMembership/channelMembership.test.ts`: `AddChannelMemberSchema`（正常 / `employeeId` 空で失敗）、`ChannelMembershipSchema`。
  - `logic/buildRosterMessages.membership.test.ts`: `membershipByChannel` 指定時、各チャンネルで所属 Employee のみが speaker になる / 未所属は発言しない / 未指定なら従来挙動。
- server
  - `persistence/channelMembershipRepository.test.ts`: 追加 / 除外 / 冪等 / 多対多（1 employee → 複数 channel、1 channel → 複数 employee）/ `listMembershipByChannel`。
  - `routes/channels.test.ts`: 未ログインで POST/DELETE は 401、認証済みで追加 201・除外 204、`employeeId` 空で 400、GET で所属反映、多対多反映。
  - `batch/rosterMessageGenerator.membership.test.ts`: `membershipByChannel` を渡すと所属 Employee のみが発言。

## 7. リスク・未決事項

- Employee / Channel の実体（行）の存在検証は本 Issue では行わない（CRUD は別 Issue）。
  Prisma 実装は FK 制約により未存在 id への所属作成は失敗しうるが、ルート層の 404/409 ハンドリングは
  Channel/Employee CRUD（#47 等）確定後に追補とする（本 Issue は所属関係の確立に集中）。
- ローカル検証環境の Node は 22（リポジトリは `engines.node >=26`）。`engine-strict` を無効化して
  install / test を実行する。CI は規定の Node で走る前提。
