# 設計書: Message.speaker を createdEmployeeId にリネームし Employee への外部キー制約を貼る (#222)

## 1. 目的 / 背景

現状の `Message` テーブルの発言者は FK 制約のない文字列カラム `speaker` として保持されており、
`Employee.id` を指す前提だが DB レベルでの参照整合性が保証されていない。
`speaker` → `createdEmployeeId` にリネームし、`Employee.id` への外部キー制約を貼ることで
「発言者は必ず実在の Employee」という不変条件を DB で担保する。

## 2. スコープ（やること / やらないこと）

### やること
- `Message.speaker` → `Message.createdEmployeeId` のリネーム（DB・common スキーマ・server・client 全経路）
- `createdEmployeeId → Employee.id` の外部キー制約追加（`onDelete: Restrict`）
- `ai-planner` を Employee として seed（FK 違反防止）
- OpenAPI 再生成 / client 型生成が型エラーなく通ること

### やらないこと
- Employee 削除 UI の実装（スコープ外）
- 経験値・関係値など MVP 外の拡張

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. `MessageSchema` と `MessageRecordSchema` が `createdEmployeeId` フィールドを持つ（`speaker` は存在しない）
2. `buildRosterMessages` の戻り値に `createdEmployeeId` フィールドがある
3. `parseConversationMessages` が LLM JSON の `createdEmployeeId` キーをパースできる
4. `formatRecentLog` が `m.createdEmployeeId` を使って整形する
5. Prisma スキーマに `createdEmployeeId String` + FK リレーション（`onDelete: Restrict`）が定義されている
6. 企画バッチ（`planningBatch.ts`）が `createdEmployeeId: "ai-planner"` を使い、seed に `ai-planner` が存在する
7. `ChannelView` が `message.createdEmployeeId` で displayName を解決して表示する
8. `pnpm turbo run build`・`pnpm turbo run test`・`pnpm turbo run lint` が全て緑

## 4. 設計方針

### 4-1. LLM JSON 出力キー
`buildChannelConversationPrompt` のプロンプトおよび `parseConversationMessages` のパーサーで
`createdEmployeeId` を使う。マッピング層は作らない（キー名を変えるだけで整合可）。

### 4-2. `BuildSummaryPromptInput.messages` インターフェース
`{ speaker: string; text: string }[]` は `buildSummaryPrompt` 内部の prompt 組み立て専用型であり、
DB フィールド名に依存しない。インターフェースは変更せず、`runSummaryBatch.ts` で
`m.createdEmployeeId` を `speaker` キーにマッピングする（1 行変更のみ）。

### 4-3. onDelete 挙動
`Restrict` — 発言を持つ Employee は削除不可。`SetNull` は `createdEmployeeId` が
必須カラムのため不可。MVP で Employee 削除 UI は存在しないが、将来への方針を記録する。

### 4-4. ai-planner Employee
`seedDevData.ts` に `ai-planner`（`isBot: true`）を追加。
移行時に既存データで FK 違反が起きないよう、マイグレーション SQL にも
`INSERT ... ON CONFLICT DO NOTHING` でフォールバック挿入を行う。

### 4-5. 既存データの保持
Prisma マイグレーションで `ALTER TABLE "Message" RENAME COLUMN "speaker" TO "createdEmployeeId"` を
使い、既存データを DROP+ADD せずに保持する。

## 5. 影響範囲 / 既存への変更

| ワークスペース | 変更ファイル |
|---|---|
| **common** | `domain/message/message.ts`、`logic/buildRosterMessages.ts`、`logic/buildChannelConversationPrompt.ts`、`logic/parseConversationMessages.ts`、`logic/formatRecentLog.ts` |
| **server** | `prisma/schema.prisma`、`prisma/migrations/` (新規)、`prisma/seedDevData.ts`、`persistence/messageRepository.ts`、`persistence/prismaMessageRepository.ts`、`batch/runMessageBatch.ts`、`batch/planningBatch.ts`、`batch/runSummaryBatch.ts`、`routes/channels.ts` |
| **client** | `components/ChannelView.tsx`、`fixtures/channelMessages.ts`、`mocks/data/fixtures.ts` |
| **テスト** | 上記に対応する全テストファイルのフィールド名更新 |

## 6. テスト計画（TDD で書くテスト一覧）

- `MessageSchema` が `createdEmployeeId` を受け入れ `speaker` を拒否する
- `MessageRecordSchema` が `createdEmployeeId` を含む完全な record を受け入れる
- `buildRosterMessages` の出力 Message に `createdEmployeeId` フィールドがある
- `parseConversationMessages` が `createdEmployeeId` キーの LLM JSON をパースできる
- `parseConversationMessages` が `speaker` キーの古い JSON は `createdEmployeeId` として扱わない
- `formatRecentLog` が `[channel] createdEmployeeId: text` 形式で整形する
- `ChannelView` が `createdEmployeeId` で displayName を解決する
- 企画バッチが `createdEmployeeId: "ai-planner"` を含む MessageRecord を作成する

## 7. リスク・未決事項

- **既存 migration 環境**: 既存データに `ai-planner` が `speaker` として存在する場合、
  FK 追加前に Employee upsert が必要。マイグレーション SQL に含めることで対処。
- **CI**: Prisma Client 再生成（`prisma generate`）が CI 環境で必要。Turborepo の既存設定で対応済みか確認する。
