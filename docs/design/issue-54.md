# 設計書: チャンネルにタイプを設定できるようにする (#54)

## 1. 目的 / 背景

AI メッセージ自動生成（#53）は `zatsudan` タイプのチャンネルのみを対象とする。
そのためチャンネルに `type` フィールド（`zatsudan` / `task`）を追加し、用途別に区別できるようにする。

## 2. スコープ（やること / やらないこと）

### やること

- `common`: `ChannelTypeSchema` / `ChannelType` 型の追加、`ChannelSchema` / `CreateChannelSchema` / `UpdateChannelSchema` に `type` フィールドを追加
- `common`: `DEFAULT_CHANNELS` の各エントリに適切な `type` を設定
- `server/prisma`: `ChannelType` enum と `Channel.type` カラム追加、マイグレーション
- `server`: `ChannelRepository` インターフェース更新（`updateLabel` → `update`）、InMemory / Prisma 実装の更新
- `server`: `GET /channels` レスポンスに `type` を含める、`POST /channels` で `type` を受け付ける、`PATCH /channels/:id` で `type` を更新できる
- `client`: チャンネル作成 UI に `type` セレクト追加、チャンネル一覧でタイプを視覚的に区別（アイコン）

### やらないこと

- `type` による表示フィルタリング（#53 依存）
- `planning` など他タイプの追加（MVP スコープ外）
- seed データのリセット（upsert で type を補完する）

## 3. 受け入れ条件（テストに落とせる粒度）

1. `ChannelTypeSchema.parse("zatsudan")` が `"zatsudan"` を返す
2. `ChannelTypeSchema.parse("task")` が `"task"` を返す
3. `ChannelTypeSchema.safeParse("invalid").success` が `false`
4. `ChannelSchema` に `type` フィールドが含まれ、parse 成功する
5. `DEFAULT_CHANNELS[0]` (`zatsudan`) の `type` が `"zatsudan"`
6. `DEFAULT_CHANNELS[1]` (`shigoto`) の `type` が `"task"`
7. `CreateChannelSchema` で `type` を省略すると `"zatsudan"` がデフォルトになる
8. `CreateChannelSchema` で `type: "task"` を明示できる
9. `UpdateChannelSchema` で `type` のみを指定できる（label なしで valid）
10. `UpdateChannelSchema` で `label` のみを指定できる
11. `UpdateChannelSchema` で `label` も `type` も省略すると invalid（400 の根拠）
12. `GET /channels` のレスポンスに `type` フィールドが含まれる
13. `POST /channels` で `type: "task"` を渡すと `type: "task"` のチャンネルが作成される
14. `POST /channels` で `type` を省略すると `type: "zatsudan"` で作成される
15. `PATCH /channels/:id` で `{ type: "task" }` を渡すとタイプが更新される
16. チャンネル作成 UI に `type` 選択フィールドがある
17. チャンネル一覧で `zatsudan` と `task` を視覚的に区別できる

## 4. 設計方針

### ChannelTypeSchema（common）

```ts
export const ChannelTypeSchema = z.enum(["zatsudan", "task"]);
export type ChannelType = z.infer<typeof ChannelTypeSchema>;
```

### ChannelSchema（common）

```ts
export const ChannelSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  type: ChannelTypeSchema,
});
```

### CreateChannelSchema（common）

```ts
export const CreateChannelSchema = z.object({
  label: z.string().min(1),
  type: ChannelTypeSchema.optional().default("zatsudan"),
});
```

### UpdateChannelSchema（common）

両フィールドを optional にし、少なくとも一方を必須とする refine を追加。

```ts
export const UpdateChannelSchema = z.object({
  label: z.string().min(1).optional(),
  type: ChannelTypeSchema.optional(),
}).refine(
  (data) => data.label !== undefined || data.type !== undefined,
  { message: "label または type のいずれかを指定してください" }
);
```

### ChannelRepository（server）

`updateLabel(id, label)` を `update(id, input: UpdateChannelInput)` に置き換える。

### Prisma マイグレーション

```prisma
enum ChannelType {
  zatsudan
  task
}

model Channel {
  id    String      @id
  label String
  type  ChannelType @default(zatsudan)
  ...
}
```

### client: AddChannelForm

既存の `label` TextField に加え、`zatsudan` / `task` を選択するラジオボタンを追加。

### client: ChannelList

チャンネルの `type` に応じてアイコンを表示する。
- `zatsudan`: `TagIcon`（MUI の `#` 記号をイメージ）
- `task`: `ChecklistIcon`

## 5. 影響範囲

- `common/src/domain/channel/channel.ts`（スキーマ変更）
- `common/src/domain/channel/channel.test.ts`（新テスト追加 + 既存テスト更新）
- `server/prisma/schema.prisma`（enum・カラム追加）
- `server/prisma/seedDevData.ts`（SeedPrisma インターフェース + 実装更新）
- `server/src/persistence/channelRepository.ts`（インターフェース + InMemory 実装更新）
- `server/src/persistence/prismaChannelRepository.ts`（Prisma 実装更新）
- `server/src/routes/channels.ts`（ルートハンドラ更新）
- `server/src/routes/channels.test.ts`（新テスト追加 + 既存テスト更新）
- `client/src/components/AddChannelForm.tsx`（type 選択追加）
- `client/src/components/AddChannelForm.test.tsx`（新テスト追加）
- `client/src/components/ChannelList.tsx`（type アイコン追加）
- `client/src/components/ChannelList.test.tsx`（新テスト追加）

## 6. テスト計画（TDD で書くテスト一覧）

### common

- `ChannelTypeSchema` の valid/invalid ケース
- `ChannelSchema` に `type` が含まれること
- `DEFAULT_CHANNELS` の `type` 設定
- `CreateChannelSchema` の `type` デフォルト
- `UpdateChannelSchema` の refine

### server（routes/channels.test.ts）

- `GET /channels` → `type` フィールド含む
- `POST /channels` with/without `type`
- `PATCH /channels/:id` with `type`

### client

- `AddChannelForm` に type ラジオボタンが表示される
- `ChannelList` でアイコンが表示される

## 7. リスク・未決事項

- Prisma マイグレーションは CI 環境（実 DB なし）ではスキップされるため、統合テスト `.int.test.ts` は影響しないことを確認する
- `UpdateChannelSchema` の `refine` が既存の `updateLabel` 呼び出しと整合するよう、ルートハンドラを `update` に切り替える必要あり
