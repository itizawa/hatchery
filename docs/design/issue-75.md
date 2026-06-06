# 設計書: AI バッチ実行ログ（成功・失敗）を永続化し、管理画面で閲覧できるようにする (#75)

## 1. 目的 / 背景

定時バッチ（`server/src/batch/`）が失敗しても `console.error` のみで終わり、エラーが永続化されない。
ユーザーが「なぜ AI 社員が動いていないか」に気づける仕組みを作るため、バッチ実行結果を DB に記録し管理画面で閲覧できるようにする。

## 2. スコープ（やること / やらないこと）

### やること
- Prisma スキーマに `BatchRunLog` モデルを追加
- `common` に Zod スキーマ（`BatchRunLogRecordSchema`）を追加
- `server` にリポジトリ（interface / InMemory / Prisma 実装）を追加
- `runMessageBatch` を改修してログを保存する
- `GET /batch-logs` エンドポイント（認証必須・直近 50 件降順）を追加
- OpenAPI レジストリに登録
- `client` に API フック（`useBatchLogs`）を追加
- 管理画面（`/admin`）に「バッチログ」タブを追加

### やらないこと
- バッチのリトライ実装
- バッチログの削除 API
- 50 件を超える履歴の閲覧（ページネーション）

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

- `BatchRunLog` モデルが Prisma スキーマに存在する（id/executedAt/status/messageCount/errorMessage/errorCode）
- `InMemoryBatchRunLogRepository.create()` で保存、`listRecent(50)` で直近 50 件を返す
- `GET /batch-logs` が未認証で 401 を返す
- `GET /batch-logs` が認証済みで 200 と `BatchRunLogRecord[]` を返す
- `runMessageBatch` が成功時に `status=success`・`messageCount=N` のログを保存する
- `runMessageBatch` が失敗時に `status=failure`・`errorMessage` のログを保存する
- 管理画面に「バッチログ」タブが表示され、一覧を確認できる

## 4. 設計方針（アーキ・データ構造・主要モジュール）

### データモデル
```prisma
model BatchRunLog {
  id           String   @id @default(cuid())
  executedAt   DateTime @default(now())
  status       String   // "success" | "failure"
  messageCount Int?
  errorMessage String?
  errorCode    String?

  @@index([executedAt])
}
```

### Zod スキーマ（common）
- `BatchRunLogRecordSchema`: `{ id, executedAt: z.date(), status: z.enum(["success","failure"]), messageCount: z.number().int().nullable(), errorMessage: z.string().nullable(), errorCode: z.string().nullable() }`

### リポジトリ（server）
- `BatchRunLogRepository` インターフェース: `create(input) / listRecent(limit)`
- `InMemoryBatchRunLogRepository`: テスト用
- `PrismaBatchRunLogRepository`: 本番用

### ルート
- `GET /batch-logs` → `createBatchLogsRouter(repo)` → `app.use("/batch-logs", ...)`
- `AppDeps` に `batchRunLogRepository?: BatchRunLogRepository` を追加（省略時 InMemory）

### バッチ統合
- `RunMessageBatchDeps` に `batchRunLogRepository?: BatchRunLogRepository` を追加
- `runMessageBatch` で try/catch し成功・失敗をログ保存

### クライアント
- `client/src/api/batchLogs.ts`: `useBatchLogs()` フック（`openApiClient.GET("/batch-logs")`）
- `settingsTabValues.ts` に `"batch-logs"` を追加
- `client/src/components/BatchLogTab.tsx`: タブコンテンツコンポーネント

## 5. 影響範囲 / 既存への変更

| ファイル | 変更種別 |
|----------|----------|
| `server/prisma/schema.prisma` | `BatchRunLog` モデル追加 |
| `common/src/domain/batchRunLog/index.ts` | 新規 |
| `common/src/index.ts` | `batchRunLog` のエクスポート追加 |
| `server/src/persistence/batchRunLogRepository.ts` | 新規 |
| `server/src/batch/runMessageBatch.ts` | deps に repo 追加、try/catch でログ保存 |
| `server/src/batch/index.ts` | `PrismaBatchRunLogRepository` 注入 |
| `server/src/routes/batch-logs.ts` | 新規 |
| `server/src/app.ts` | `batchRunLogRepository` を deps に追加・ルート登録 |
| `server/src/openapi/registry.ts` | `BatchRunLogRecord` と `GET /batch-logs` を登録 |
| `client/src/api/batchLogs.ts` | 新規 |
| `client/src/routes/settingsTabValues.ts` | `"batch-logs"` 追加 |
| `client/src/components/BatchLogTab.tsx` | 新規 |
| `client/src/routes/SettingsScene.tsx` | バッチログタブ追加 |

## 6. テスト計画（TDD で書くテスト一覧）

### `server/src/persistence/batchRunLogRepository.test.ts`
- `create()` でレコードが保存される
- `listRecent(N)` で N 件以内を executedAt 降順で返す
- `listRecent(50)` で 50 件を超える場合は最新 50 件のみ返す

### `server/src/routes/batch-logs.test.ts`
- 未認証の場合は 401
- 認証済みの場合は 200 と配列を返す
- 保存済みのログが一覧に含まれる

### `server/src/batch/runMessageBatch.test.ts`（既存テストに追記）
- 成功時にリポジトリへ `status=success` のログが保存される
- 失敗時にリポジトリへ `status=failure` のログが保存される

## 7. リスク・未決事項

- `PrismaBatchRunLogRepository` は Integration Test（DB 必須）のみで確認する（Unit はモック）
- クライアントの `openApiClient` 経由の型は `openapi.gen.ts` が生成されないと使えないため、型が確認できない場合は `fetch` フォールバックで進める（ADR-0006 の精神に沿い、将来移行を推奨）
