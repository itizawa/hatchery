# 設計書: runCommunityBatch リトライ実装範囲の設計 (#905)

## 1. 目的 / 背景

Issue #626（バッチ生成失敗時のリトライ）の実装範囲を確定させ、`docs/design/issue-626.md` を作成する。
`server/src/batch/runCommunityBatch.ts` は #672 以降の refactoring で `runPostBatch.ts` / `runCommentBatch.ts` に分割されており、#905 起票時点での想定ファイル名は存在しない。
本設計書は #905 の受け入れ条件が develop へのマージ済みコミットによってどのように充足されたかを記録する。

## 2. スコープ（やること / やらないこと）

### やること

- `docs/design/issue-626.md` の作成（`withGenerationRetry` 設計を記載）
- `withGenerationRetry` ユーティリティの実装（`server/src/batch/withGenerationRetry.ts`）
- `runPostBatch.ts` および `runCommentBatch.ts` へのリトライ組み込み
- リトライのユニットテスト・統合テスト追加

### やらないこと

- `runCommunityBatch.ts` への実装（ファイルは #672 以降 refactoring により存在しない）
- 外部 API（Anthropic）のレート制限・ネットワークエラーへのリトライ
- 指数バックオフ

## 3. 受け入れ条件

1. `docs/design/issue-626.md` を作成する → ✅（feature/issue-626 PR でマージ済み）
2. `server/src/batch/runCommunityBatch.ts`（または相当するファイル）にリトライロジックを実装する → ✅（`runPostBatch.ts`・`runCommentBatch.ts` に `withGenerationRetry(maxRetries=2)` を組み込み済み）
3. リトライ成功・上限到達・非リトライエラーのテストを追加する → ✅（`withGenerationRetry.test.ts`・`runPostBatch.test.ts`・`runCommentBatch.test.ts` に追加済み）
4. `pnpm turbo run build test lint` が緑 → ✅（develop に CI 通過済みでマージ済み）

## 4. 設計方針

詳細は `docs/design/issue-626.md` を正本とする。要点のみ抜粋:

- **実装レイヤー**: `withGenerationRetry` を共通ユーティリティとして `server/src/batch/` に新設し、`runPostBatch` / `runCommentBatch` の生成ステップをラップする
- **リトライ対象**: `RetryableGenerationError`（JSON パース失敗・スキーマ検証失敗・author 検証失敗）のみ。その他の Error は即 throw
- **最大リトライ回数**: 2（合計 3 試行）
- **バックオフ**: なし（即再試行）

## 5. 影響範囲

- `server/src/batch/withGenerationRetry.ts`（新規）
- `server/src/batch/runPostBatch.ts`（変更）
- `server/src/batch/runCommentBatch.ts`（変更）
- `server/src/batch/withGenerationRetry.test.ts`（新規）
- `server/src/batch/runPostBatch.test.ts`（変更）
- `server/src/batch/runCommentBatch.test.ts`（変更）
- `docs/design/issue-626.md`（新規）

## 6. テスト計画

`docs/design/issue-626.md` §6 のテスト計画に準拠。すべて実装済み・緑確認済み。

## 7. リスク・未決事項

なし（すべての受け入れ条件が develop へのマージ済みコミットで充足されている）。
