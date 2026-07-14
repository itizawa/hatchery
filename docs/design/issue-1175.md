# 設計書: server/src/logger.ts・batch/logger.ts・batch/schedule.ts の位置引数関数をオブジェクト引数化する (#1175)

## 1. 目的 / 背景

CLAUDE.md「関数引数規約（#720）」は引数 2 個以上の関数をオブジェクト引数に統一するよう定めている。`server/src/logger.ts`・`server/src/batch/logger.ts`・`server/src/batch/schedule.ts` の一部関数が、Express ミドルウェアでも配列コールバックでもないのに位置引数のまま `eslint-disable-next-line max-params` で例外扱いになっている。これらはリポジトリ全体（HTTP 側・バッチ側の両方）から高頻度に呼ばれるログユーティリティであり、位置引数のまま残ると呼び出し側の可読性・引数順序ミスのリスクが継続する。

## 2. スコープ（やること / やらないこと）

### やること
- `logInfo` / `logError`（`server/src/logger.ts`）をオブジェクト引数化する。
- `logBatchInfo` / `logBatchError`（`server/src/batch/logger.ts`）をオブジェクト引数化する。
- `msUntilNext`（`server/src/batch/schedule.ts`）をオブジェクト引数化する（`now` の既定値 `new Date()` は維持）。
- 上記関数のすべての呼び出し元（HTTP ルート・ミドルウェア・バッチ処理・テスト）を新シグネチャに追従させ、対象関数の `eslint-disable-next-line max-params` を削除する。

### やらないこと（スコープ外）
- `SchedulerPort.scheduleDaily` の実装（`schedule.ts:70`）と `startMessageBatchScheduler`（`schedule.ts:110`）の位置引数化。Issue #1175 の受け入れ条件 1〜4 は `logInfo` / `logError` / `logBatchInfo` / `logBatchError` / `msUntilNext` の 5 関数のみを名指ししており、`scheduleDaily` はテスト用フェイク実装（`schedule.test.ts`）が複数箇所で部分適用（`scheduleDaily(hour)` のように一部引数のみ実装）しているポート抽象であり、オブジェクト引数化すると `SchedulerPort` インターフェース自体の破壊的変更になり受け入れ条件の範囲を超える。本 Issue では対象外とし、必要であれば別 Issue で扱う。
- ログ出力フォーマット（`severity`/`level`/`event` 等の JSON キー）の変更（AC5 で明示的に維持が求められている）。
- `server/src/logger.ts` と `server/src/batch/logger.ts` の統合（意図的に別モジュール・#865 参照）。

## 3. 受け入れ条件（テストに落とせる粒度）

1. `logInfo({ event, fields })` / `logError({ event, err, fields })` に変更し、出力 JSON ペイロードは変更前と同一であること。
2. `logBatchInfo({ event, fields })` / `logBatchError({ event, err, fields })` に変更し、出力 JSON ペイロードは変更前と同一であること。
3. `msUntilNext({ hour, minute, now })` に変更し、`now` を省略した場合は `new Date()` が使われること。戻り値の計算ロジックは変更しないこと。
4. 上記 5 関数のすべての呼び出し元が新シグネチャで呼び出されており、`eslint-disable-next-line max-params` が対象関数から削除されていること。
5. `pnpm turbo run build test lint` が緑であること。

## 4. 設計方針（アーキ・データ構造・主要モジュール）

各関数の第一引数を単一のオプションオブジェクトに置き換える。オブジェクトの型は関数のすぐ上（またはファイル内）に明示的な `interface`/`type` として定義し、呼び出し側の型安全性を保つ。

- `server/src/logger.ts`
  - `interface LogInfoOptions { event: string; fields?: LogFields }`
  - `interface LogErrorOptions { event: string; err: unknown; fields?: LogFields }`
  - `export function logInfo({ event, fields }: LogInfoOptions): void`
  - `export function logError({ event, err, fields }: LogErrorOptions): void`
- `server/src/batch/logger.ts`
  - `interface LogBatchInfoOptions { event: string; fields?: BatchLogFields }`
  - `interface LogBatchErrorOptions { event: string; err: unknown; fields?: BatchLogFields }`
  - `export function logBatchInfo({ event, fields }: LogBatchInfoOptions): void`
  - `export function logBatchError({ event, err, fields }: LogBatchErrorOptions): void`
- `server/src/batch/schedule.ts`
  - `interface MsUntilNextOptions { hour: number; minute: number; now?: Date }`
  - `export function msUntilNext({ hour, minute, now = new Date() }: MsUntilNextOptions): number`
  - 内部呼び出し（`scheduleDaily` 実装内の `msUntilNext(hour, minute)` 呼び出し）も新シグネチャに追従させる。

関数内部のロジック（JSON ペイロード構築・予約キーのサニタイズ・時刻計算）は変更しない。

## 5. 影響範囲 / 既存への変更（対象ワークスペース: server）

`common` / `client` への影響なし。`server` ワークスペース内、以下のファイルの呼び出し元を新シグネチャへ追従させる:

- `server/src/logger.ts`（定義）/ `server/src/logger.test.ts`
- `server/src/server.ts`
- `server/src/routes/health.ts`
- `server/src/middleware/errorHandler.ts`
- `server/src/lifecycle/gracefulShutdown.ts`
- `server/src/batch/logger.ts`（定義）/ `server/src/batch/logger.test.ts`
- `server/src/batch/schedule.ts`（定義）/ `server/src/batch/schedule.test.ts`
- `server/src/batch/aiMessageGenerator.ts`
- `server/src/batch/commentBatchIndex.ts`
- `server/src/batch/persistBatchOutput.ts`
- `server/src/batch/postBatchIndex.ts`
- `server/src/batch/runCommentBatch.ts`
- `server/src/batch/runPostBatch.ts`
- `server/src/batch/withGenerationRetry.ts`
- `server/src/services/pushNotificationService.ts`

## 6. テスト計画（TDD で書くテスト一覧）

既存の `logger.test.ts` / `batch/logger.test.ts` / `batch/schedule.test.ts`（`msUntilNext` 部分）はいずれも位置引数で呼び出しているため、新シグネチャに合わせて**まず更新し、型エラー/失敗を確認してから実装を変更する**（テストファイル自体は「実装中は変更しない」対象だが、シグネチャ変更に伴う入力形式の更新はテスト作成フェーズの一部として扱う）。

- `logger.test.ts`: `logInfo({ event, fields })` / `logError({ event, err, fields })` の呼び出し形式に更新し、既存アサーション（出力 JSON の内容）はそのまま維持する。
- `batch/logger.test.ts`: 同様に `logBatchInfo` / `logBatchError` をオブジェクト引数呼び出しに更新。
- `batch/schedule.test.ts`: `msUntilNext({ hour, minute, now })` 呼び出しに更新（`startMessageBatchScheduler` 関連のテストは `scheduleDaily` を含み対象外のため変更しない）。

## 7. リスク・未決事項

- `scheduleDaily` / `startMessageBatchScheduler` は本 Issue のスコープ外とした（§2 参照）。背景セクションで軽く言及されているが、受け入れ条件に明示的な番号項目がないため対象外と判断。セルフレビューで指摘があれば追加対応する。
- ログ出力の JSON キー・順序は変更しないため、Cloud Logging 側の既存パース・アラート設定への影響はない。
