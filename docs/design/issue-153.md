# Issue #153 設計書: AI トークン使用量の記録と管理画面での表示

## 目的

定時バッチの AI 呼び出しごとにトークン使用量（input_tokens / output_tokens）を永続化し、
管理画面に使用履歴と合計を表示するタブを追加する。

## 受け入れ条件の整理

1. `TokenUsageLog` Prisma モデルを追加（BatchRunLog と同じ追加手順を踏む）
2. 定時バッチが API レスポンスの `usage` を取得して記録する
3. 管理 API `GET /admin/token-usage` を追加する（admin ロールゲート）
4. 管理画面に「トークン使用量」タブを追加する
5. 集計は素朴な合計表示（直近 N 件 + 総トークン数）
6. テスト追加・pnpm turbo run build|test|lint 緑

## アーキテクチャ設計

### common（Zod スキーマ）

`common/src/domain/tokenUsageLog/` を新規作成：
- `TokenUsageLogSchema`: id / occurredAt / model / inputTokens / outputTokens / batchRunLogId?
  - model: `.max(100)`（モデル名は短い）
  - 数値フィールドは `z.number().int().nonnegative()`

### server（永続化・ルーティング）

- `server/src/persistence/tokenUsageLogRepository.ts`: IF + InMemory実装
- `server/src/persistence/prismaTokenUsageLogRepository.ts`: Prisma実装
- `server/src/routes/token-usage.ts`: `GET /admin/token-usage`（admin ロールゲート）
- `server/src/app.ts`: `tokenUsageLogRepository` を AppDeps に追加・配線

### Prisma マイグレーション

`TokenUsageLog` モデルを `schema.prisma` に追加：
```prisma
model TokenUsageLog {
  id           String    @id @default(uuid(7))
  occurredAt   DateTime  @default(now())
  model        String
  inputTokens  Int
  outputTokens Int
  batchRunLogId String?
  @@index([occurredAt])
}
```

### バッチ（usage 記録）

`planningBatch.ts` の `generateProposalsWithClaude` で `message.usage` を取得し、
依存注入された `tokenUsageLogRepository.create(...)` を呼ぶ。
- `RunPlanningBatchDeps` に `tokenUsageLogRepository?: TokenUsageLogRepository` を追加
- バッチ失敗時（エラーキャッチ）でも usage が返ってきていれば記録する

### API レスポンス設計

`GET /admin/token-usage`:
```json
{
  "logs": [...TokenUsageLog],
  "summary": {
    "totalInputTokens": 1234,
    "totalOutputTokens": 567,
    "totalTokens": 1801
  }
}
```

### client

- `client/src/api/tokenUsage.ts`: `useTokenUsage()` フック
- `SettingsScene.tsx`: `TokenUsageTab` コンポーネント追加・SETTINGS_TABS に追加
- `settingsTabValues.ts`: `"token-usage"` を追加

## TDD 実装順

1. common の TokenUsageLogSchema のテスト
2. server persistence の InMemory リポジトリのテスト
3. server ルートのテスト（GET /admin/token-usage）
4. client API フックのテスト
5. planningBatch の usage 記録テスト
