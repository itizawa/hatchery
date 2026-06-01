# 設計書: チャンネル名を更新できるようにする (#37)

## 1. 目的 / 背景

チャンネル名の更新機能（PATCH /channels/:id）を実装する。
現状 Channel モデルは Prisma に存在するが更新 API がない。

## 2. スコープ（やること / やらないこと）

**やること**
- `PATCH /channels/:id` エンドポイントの実装
- `requireAuth`（ログイン必須）による認可
- Zod スキーマ（common）でリクエスト検証（label の空文字は 400）
- 存在しないチャンネル ID は 404
- 成功時 200 で更新後チャンネル情報を返す
- OpenAPI スキーマ定義

**やらないこと（今回のスコープ外）**
- チャンネルごとの所有者（ownerId）モデル導入と 403 認可。
  現在の Channel モデルに所有者カラムが存在しない（ADR 上も `id / label` のみ）。
  Issue #37 コメントに記載の Option 1 として「単一テナント前提＝requireAuth のみで認可」とする。
  所有者ベースの 403 は #47（チャンネル作成・DB 移行）で所有者モデルが確定後に対応する。
- Prisma（DB）実装（InMemory 実装のみ。統合テストは DB 環境が必要なため本 Issue の TDD スコープ外）

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

- 未ログインで PATCH /channels/:id を呼ぶと 401 を返す
- ログイン済みで有効な label（非空文字）を送ると 200 と更新後チャンネル（`{ id, label }`）を返す
- label が空文字列の場合は 400 を返す
- 存在しないチャンネル ID を指定した場合は 404 を返す
- エンドポイントが OpenAPI ドキュメントに定義される

## 4. 設計方針

- `common` に `UpdateChannelSchema`（`{ label: z.string().min(1) }`）を追加。リクエスト検証は `validateBody` ミドルウェアで行う
- `server/persistence/channelRepository.ts` に `ChannelRepository` インターフェースと `InMemoryChannelRepository` を追加（既存パターンと同様）
- `createChannelsRouter` に `ChannelRepository` を追加引数として渡す
- `AppDeps` に `channelRepository?: ChannelRepository` を追加（省略時は `InMemoryChannelRepository`）

## 5. 影響範囲 / 既存への変更

| 対象 | 変更内容 |
|------|---------|
| `common/src/domain/channel/channel.ts` | `UpdateChannelSchema` / `UpdateChannelInput` を追加 |
| `server/src/persistence/channelRepository.ts` | 新規作成（ChannelRepository IF + InMemory 実装） |
| `server/src/routes/channels.ts` | `createChannelsRouter` に `channelRepo` 引数追加、`PATCH /:id` 追加 |
| `server/src/routes/channels.test.ts` | PATCH /channels/:id のテストを追加 |
| `server/src/app.ts` | `AppDeps.channelRepository` 追加、ルータへ渡す |
| `server/src/openapi/registry.ts` | PATCH /channels/{id} パスを追加 |

## 6. テスト計画（TDD で書くテスト一覧）

1. `PATCH /channels/:id` - 未ログインで 401
2. `PATCH /channels/:id` - ログイン済み・有効 label で 200 + 更新後チャンネル
3. `PATCH /channels/:id` - label 空文字で 400
4. `PATCH /channels/:id` - 存在しない ID で 404

## 7. リスク・未決事項

- チャンネル所有者モデルが未実装のため 403 認可は今回スコープ外（設計コメント参照）
- Prisma 実装（`PrismaChannelRepository`）は DB 環境依存のため別 Issue または #47 で対応
