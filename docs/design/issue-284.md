# 設計書: チャンネルに goal（出力契約）を導入し、AI 出力をバッチ dispatch から一般化する (#284)

## 1. 目的 / 背景

現状、バッチ処理のロジックが `ChannelType` の値にハードコードで紐づいている（`zatsudan` → `runAiMessageBatch`、`planning` → `runPlanningBatch`）。新しい AI の振る舞いを追加するたびにハードコード分岐が増える構造になっているため、チャンネルに `goal`（出力契約）を導入し、dispatch を goal 駆動に一般化する。

## 2. スコープ（やること / やらないこと）

### やること
- ADR-0016 の追加（channel goal 概念の決定記録）
- common に `ChannelGoalTypeSchema`・`ChannelGoalSchema` を追加し `ChannelSchema` に組み込む
- Prisma スキーマに `goalType` / `goalInstructions` カラムを追加
- 移行: 既存 `type` から `goalType` を導出する migration
- `InMemoryChannelRepository` / `PrismaChannelRepository` のマッピング更新
- バッチ dispatch を `goal.type` 駆動に変更（等価性テストで担保）
- client `CreateChannelDialog`: `type` 選択を `goal.type` 選択に置き換え

### やらないこと
- リッチな goal 編集 UI（別 Issue）
- `instructions` フィールドの UI 編集（将来拡張）
- 競合調査・外部リサーチの実装（後続 Issue）
- `type` の完全廃止（backward compat のため DB に残す）

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. `ChannelGoalSchema` が `{ type: "chat" | "issue", instructions?: string }` を検証できる
2. `ChannelSchema` が `goal` フィールドを含む
3. `DEFAULT_CHANNELS` の goal: zatsudan=chat, shigoto=chat, kikaku=issue
4. `runAiMessageBatch` が `goal.type === "chat"` のチャンネルにのみ実行される（zatsudan も task も対象）
5. `runPlanningBatch` が `goal.type === "issue"` のチャンネルを対象にする（ハードコード "kikaku" を廃止）
6. `pnpm turbo run build test lint` が緑

## 4. 設計方針

### goal フィールドの構造（ドメイン層）
```typescript
ChannelGoalTypeSchema = z.enum(["chat", "issue"])
ChannelGoalSchema = z.object({ type: ChannelGoalTypeSchema, instructions: z.string().max(500).optional() })
ChannelSchema = ... + goal: ChannelGoalSchema
```

### Prisma（永続化層）
- `ChannelGoalType` enum を追加: `chat` | `issue`
- `Channel` モデルに `goalType ChannelGoalType @default(chat)` と `goalInstructions String?` を追加
- `type` カラムは backward compat のため残す
- マイグレーション: `planning` → `issue`、その他 → `chat` に変換

### type との関係（ADR-0016 で確定）
- `type` は表示カテゴリ（zatsudan/task/planning）として残す（廃止は将来）
- `goal` が AI 振る舞いの正式な決定要素（dispatch は goal のみ参照）
- 独立した概念: 将来 `zatsudan` タイプのチャンネルを `issue` goal にすることも可能

### バッチ dispatch の変更
- `runAiMessageBatch`: フィルタ `c.type === "zatsudan"` → `c.goal.type === "chat"`
- `runPlanningBatch`: ハードコード `PLANNING_CHANNEL_ID` → チャンネル一覧から `goal.type === "issue"` で絞り込み

### クライアント UI（最小対応）
- `CreateChannelDialog`: type RadioGroup を goal.type RadioGroup（発言/起票）に置き換え
- `CreateChannelSchema`: goal フィールドを追加（default: `{ type: "chat" }`）

## 5. 影響範囲 / 既存への変更

| ワークスペース | ファイル | 変更内容 |
|---|---|---|
| common | `domain/channel/channel.ts` | ChannelGoalSchema 追加、ChannelSchema に goal 追加 |
| server | `prisma/schema.prisma` | goalType / goalInstructions カラム追加 |
| server | `prisma/migrations/...` | 新規マイグレーション |
| server | `persistence/channelRepository.ts` | InMemory 実装更新 |
| server | `persistence/prismaChannelRepository.ts` | Prisma マッピング更新 |
| server | `batch/runAiMessageBatch.ts` | goal フィルタに変更 |
| server | `batch/planningBatch.ts` | goal 駆動に変更 |
| client | `components/CreateChannelDialog.tsx` | goal.type 選択 UI |

## 6. テスト計画（TDD で書くテスト一覧）

1. `common`: `ChannelGoalSchema` バリデーション（有効・無効・instructions 上限）
2. `common`: `ChannelSchema` が goal フィールドを含む
3. `common`: `DEFAULT_CHANNELS` の goal 値
4. `server/batch`: `runAiMessageBatch` が goal=chat チャンネルのみ対象にする
5. `server/batch`: goal=task の channel は対象外（type=task でも goal=chat なら対象）
6. `server/batch`: `runPlanningBatch` が goal=issue チャンネルを対象にする（ID ハードコードなし）

## 7. リスク・未決事項

- Prisma マイグレーションは DB 接続が必要。worktree 環境では `--create-only` で作成のみ行う。
- `UpdateChannelSchema` の `.refine` 条件を `goal` を含む形に更新（後方互換）。
