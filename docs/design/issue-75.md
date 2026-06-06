# 設計書: AI バッチ実行ログ（成功・失敗）を永続化し、管理画面で閲覧できるようにする (#75)

## 1. 目的 / 背景

定時バッチ（`runMessageBatch`）の成功・失敗を DB に記録し、管理画面から確認できるようにする。
現状は失敗しても `console.error` に出力するだけで永続化されず、ユーザーが「なぜ AI 社員が動いていないか」を知る手段がない。

## 2. スコープ（やること / やらないこと）

**やること:**
- `BatchRunLog` Prisma モデル追加（id/executedAt/status/messageCount/errorMessage/errorCode）
- `runMessageBatch` にログ保存処理を追加（成功時・失敗時）
- `GET /admin/batch-logs` エンドポイント追加（認証必須・直近 50 件・executedAt 降順）
- 設定画面に「バッチログ」タブを追加してログ一覧を表示
- `BatchRunLogSchema` を `common` に追加

**やらないこと:**
- バッチの再実行機能
- ログの削除機能
- ページネーション（直近 50 件固定）
- 外部ログ収集への連携

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

- `runMessageBatch` が成功した場合、`BatchRunLogRepository.create({ status: "success", messageCount: n })` が呼ばれる
- `runMessageBatch` が失敗（generate or repo throw）した場合、`BatchRunLogRepository.create({ status: "failure", errorMessage, errorCode })` が呼ばれ、エラーは再スローされる
- `batchRunLogRepository` が未注入（undefined）の場合はログ保存せず既存動作のまま
- `GET /admin/batch-logs` を未認証で呼ぶと 401
- `GET /admin/batch-logs` を認証済みで呼ぶと 200 と `BatchRunLog[]`（executedAt 降順・最大 50 件）
- 設定画面に「バッチログ」タブが存在し、`executedAt`・`status`・`messageCount`（成功時）・`errorMessage`（失敗時）を表示する
- `status=failure` の行は視覚的に強調される

## 4. 設計方針

### API エンドポイントのパス選択
Issue では `/api/batch-logs` と記載されているが、既存コードベースは `/admin/settings` のように `/admin/*` 配下に管理 API を置く慣習（`/api` プレフィックスは未使用）。一貫性のため `GET /admin/batch-logs` を採用する。

### BatchRunLogSchema の配置
- `common/src/domain/batchRunLog/` に Zod スキーマを置く（client・server で共有する型のため）
- `BatchRunLogStatus` は `"success" | "failure"` の enum

### runMessageBatch の変更
- `batchRunLogRepository?: BatchRunLogRepository` をオプションで追加（既存テストへの後方互換性）
- try/catch で包み、成功時・失敗時にそれぞれ `batchRunLogRepository?.create(...)` を呼ぶ

### 永続化
- `BatchRunLogRepository` interface + `InMemoryBatchRunLogRepository`（テスト用）を実装
- `PrismaBatchRunLogRepository` は実 DB 接続テスト対応外（統合テストなし）

## 5. 影響範囲 / 既存への変更

- `common/src/domain/batchRunLog/` — 新規
- `common/src/index.ts` — エクスポート追加
- `server/prisma/schema.prisma` — `BatchRunLog` モデル + enum 追加
- `server/src/persistence/batchRunLogRepository.ts` — 新規
- `server/src/batch/runMessageBatch.ts` — 依存型・ログ保存追加
- `server/src/batch/runMessageBatch.test.ts` — テスト追加
- `server/src/routes/batch-logs.ts` — 新規
- `server/src/routes/batch-logs.test.ts` — 新規
- `server/src/openapi/registry.ts` — 新規エンドポイント登録
- `server/src/app.ts` — AppDeps 追加・ルート登録
- `client/src/api/batchLogs.ts` — 新規
- `client/src/routes/settingsTabValues.ts` — `"batch-logs"` 追加
- `client/src/routes/SettingsScene.tsx` — バッチログタブ追加

## 6. テスト計画

**common（batchRunLog）:**
- `BatchRunLogSchema` が正しい構造を検証する

**server（runMessageBatch）:**
- 成功時にログが保存される
- 失敗時にログが保存され、エラーが再スローされる
- `batchRunLogRepository` 未注入時は既存動作

**server（batch-logs route）:**
- 未認証 → 401
- 認証済み・ログなし → 200 空配列
- 認証済み・ログあり → 200 executedAt 降順

## 7. リスク・未決事項

- Prisma マイグレーションは実 DB がないため `prisma migrate dev` は実行不可。スキーマ定義のみ追加し、CI ではスキップ
- `PrismaBatchRunLogRepository` の統合テストはスコープ外（InMemory でユニットテストを代替）
