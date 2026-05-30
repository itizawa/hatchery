# 設計書: Scene を廃止し、message を channel に直接紐づける（あらすじも廃止） (#27)

## 1. 目的 / 背景

現状のドメインは Scene（1 定時で生成される 1 シーン = あらすじ + 発言列）が message をまとめる構造。
しかし message を Scene にまとめる必要はなく、message は channel に直接紐づければ十分。
Scene を廃止し、message を channel 紐づきのフラットな発言として扱うようモデルを単純化する。

あわせて Scene が持っていた `scene`（あらすじ）も廃止。次の定時の入力には channel 直近 message を用いる
（`formatRecentLog` が引き続き使える）。

この変更は concept.md / ADR-0004 / ADR-0005 の記述と矛盾するため、ADR-0009 に判断を記録し、
矛盾する既存ドキュメントも本 Issue で整合させる。

## 2. スコープ（やること / やらないこと）

### やること

- ADR-0009 作成、concept.md / ADR-0004 / ADR-0005 更新
- common: `scene.ts` / `SceneSchema` / `Scene` 型を削除。`MessageArraySchema` を追加
- server:
  - Prisma スキーマ: `Scene` モデル削除、`Message` を Scene 非依存（channel 直接紐づき）に更新
  - `MessageRepository` / `InMemoryMessageRepository` を新設（`SceneRepository` 系を削除）
  - `PrismaMessageRepository` を新設（`PrismaSceneRepository` 削除）
  - ルート: `/scenes` → `/messages`（POST body は `MessageArraySchema`）
  - usecases: `createMessages` / `listMessages`（`createScene` / `listScenes` 削除）
  - バッチ: `runMessageBatch`（複数 message 生成 → channel 紐づきで永続化）
  - `app.ts`: MessageRepository に更新
  - `index.ts`: re-export を更新
- client: `HomeScene` / `ChannelScene` のシーン前提の文言を message タイムライン表示の枠に更新

### やらないこと

- LLM による定時生成の本実装（スタブ維持）
- client の API 連携・message タイムライン本実装（#8 / MVP 機能 Issue）
- Channel の DB 化や CRUD（common の `DEFAULT_CHANNELS` が単一情報源のまま）
- Phase 1 以降の拡張

## 3. 受け入れ条件（テストに落とせる粒度）

### ADR / 設計
- `docs/adr/0009-*.md` が template.md 形式で存在し、Scene 廃止の判断を記録している
- `docs/adr/README.md` に ADR-0009 の行が追加されている
- `concept.md` の「1 コールで 1 シーン」「あらすじ／要約」表現が更新されている
- ADR-0004 / ADR-0005 の Scene・あらすじ言及が整合している

### common
- `common/src/domain/scene.ts` が存在しない
- `common/src/index.ts` に `scene` の re-export が存在しない
- `common/src/index.ts` から `MessageArraySchema` がエクスポートされている
- `MessageArraySchema.parse([{ speaker: "e1", channel: "zatsudan", text: "hi" }])` が成功する
- `MessageArraySchema.safeParse([])` が失敗する（min(1) 制約）

### server（MessageRepository）
- `InMemoryMessageRepository.createMany([msg])` が `MessageRecord[]` を返し、各 record が id / speaker / channel / text / createdAt / order を持つ
- `InMemoryMessageRepository.list()` が挿入順で全 record を返す
- `InMemoryMessageRepository.list()` は防御的コピーを返す（外部からの変更が内部に影響しない）

### server（ルート / usecase）
- `POST /messages` に `[{ speaker, channel, text }]` の配列を送ると 201 で `MessageRecord[]` が返る
- `POST /messages` に空配列 / 不正データを送ると 400 が返る
- `GET /messages` が 200 で `MessageRecord[]` を返す

### server（バッチ）
- `runMessageBatch` を呼ぶと複数 message が生成されてリポジトリに保存される
- `runMessageBatch` の後 `repo.list()` が 1 件以上返す
- スタブ生成器 `stubMessageGenerator` が `Message[]` を返す
- カスタム生成器を注入できる

### server（Prisma）
- `server/prisma/schema.prisma` に `Scene` モデルが存在しない
- `Message` モデルに `sceneId` フィールドが存在しない
- `Message` モデルに `createdAt` フィールドが存在する
- マイグレーション SQL が存在する

### client
- `HomeScene` の文言が「シーン」前提でない（タイムライン/メッセージ表示の枠として表現）
- `ChannelScene` の文言が「シーン一覧」でない（メッセージタイムラインの枠として表現）

### 品質
- `turbo run lint test build` が緑

## 4. 設計方針

### MessageRecord

```typescript
interface MessageRecord {
  id: string;
  speaker: string;
  channel: string;
  text: string;
  createdAt: Date;
  order: number;  // 定時バッチ内での発言順
}
```

### MessageRepository

```typescript
interface MessageRepository {
  list(): Promise<MessageRecord[]>;
  createMany(input: Message[]): Promise<MessageRecord[]>;
}
```

### Prisma スキーマ（Message 更新後）

```prisma
model Message {
  id        String   @id @default(cuid())
  speaker   String
  channel   String
  text      String
  createdAt DateTime @default(now())
  order     Int

  @@index([channel, createdAt])
}
```

### バッチ

```typescript
type MessageGenerator = () => Message[];
// stubMessageGenerator は複数発言を返す
```

### ルート

- `GET /messages` → `listMessages(repo)` → 200
- `POST /messages` → `validateBody(MessageArraySchema)` → `createMessages(repo, body)` → 201

### 依存方向

- client → common / server → common の一方向を維持
- `MessageSchema` / `MessageArraySchema` は common に置く

## 5. 影響範囲 / 既存への変更

| ワークスペース | 変更内容 |
|---|---|
| common | `scene.ts` 削除・`index.ts` 更新・`MessageArraySchema` 追加 |
| server | Scene 系全ファイル削除、Message 系ファイル追加・更新、Prisma スキーマ変更 |
| client | `HomeScene.tsx` / `ChannelScene.tsx` テキスト更新 |
| docs | ADR-0009 追加、concept.md / ADR-0004 / ADR-0005 更新 |

## 6. テスト計画（TDD で書くテスト一覧）

| ファイル | テスト内容 |
|---|---|
| `common/src/index.test.ts` | SceneSchema の export がない・MessageArraySchema が export されている |
| `server/src/persistence/messageRepository.test.ts` | InMemoryMessageRepository の create/list/防御的コピー |
| `server/src/routes/messages.test.ts` | GET/POST /messages の正常・異常系 |
| `server/src/usecases/messages.test.ts` | createMessages / listMessages |
| `server/src/batch/runMessageBatch.test.ts` | runMessageBatch の生成・保存・スタブ・カスタム生成器 |
| `server/src/persistence/prismaMessageRepository.int.test.ts` | Prisma 実装の統合テスト（DATABASE_URL 要） |

## 7. リスク・未決事項

- Prisma マイグレーション: 既存 DB がある場合は `Scene` / `Message` テーブルの drop が必要（`prisma migrate dev` で対応）
- `order` フィールドの用途: 同一バッチ内での発言順保持のみ。バッチ間の順序は `createdAt` で管理
