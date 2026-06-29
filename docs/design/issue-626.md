# 設計書: バッチ生成失敗時のリトライ実装 (#626)

## 1. 目的 / 背景

定時バッチ（`runPostBatch` / `runCommentBatch`）が AI 生成結果の JSON パース・Zod スキーマ検証・author 検証に失敗した場合、現状は即座にスキップして `batchRunLog.errorMessage` にエラーを記録するだけで終わる。
LLM の出力は確率的に不正フォーマットになることがあり、同じプロンプトを再送すると成功するケースが多い。
最大 2 回のリトライ（合計 3 試行）を追加し、ログ上の成功率を向上させる。

## 2. スコープ（やること / やらないこと）

### やること

- `runPostBatch.ts` の `processCommunitePosts` でリトライロジックを実装（最大 2 回）
- `runCommentBatch.ts` の `processCommunityComments` でリトライロジックを実装（最大 2 回）
- リトライ対象の失敗種別: JSON パース失敗・Zod スキーマ検証失敗・author 検証失敗
- 各リトライ試行のログ出力（何回目のリトライか、コミュニティ ID）
- テスト: リトライ成功・リトライ上限到達・非リトライエラーの各パターン

### やらないこと

- 外部 API（Anthropic）のレート制限・ネットワークエラーへのリトライ（別設計が必要）
- 指数バックオフ（JSON パース失敗は待機不要。即再試行で十分）
- `aiMessageGenerator.ts` 内でのリトライ（generate 関数に責任を持たせない）
- `runPostBatch.ts` / `runCommentBatch.ts` の「ワーカー未設定」「post なし」等のスキップケースへのリトライ（AI 生成エラーではないため対象外）

## 3. 受け入れ条件（テストに落とせる粒度）

1. JSON パース失敗が 1 回発生し 2 回目に成功する場合、generate が 2 回呼ばれ post/comment が永続化される
2. スキーマ検証失敗が 1 回発生し 2 回目に成功する場合、generate が 2 回呼ばれ永続化される
3. author 検証失敗が 1 回発生し 2 回目に成功する場合、generate が 2 回呼ばれ永続化される
4. 3 回連続で同じ失敗が続く（上限到達）場合、`batchRunLog.status === 'failure'` が記録される
5. ワーカー未設定・post なし等の非 AI エラーはリトライせず即スキップされる
6. リトライ中のログに「retry」キーワードが含まれる（`logBatchInfo` / `logBatchError` 経由）

## 4. 設計方針

### リトライの実装レイヤー

`processCommunitePosts` / `processCommunityComments` 内の「AI 生成 → JSON パース → スキーマ検証 → author 検証」部分を抽出し、`withGenerationRetry` ユーティリティ関数（同 `server/src/batch/` 内）でラップする。

```
runPostBatch
  └─ processCommunitePosts × N コミュニティ (allSettled)
       └─ withGenerationRetry(maxRetries=2)
            ├─ 試行 1: generate → parse → validate → return 成果物
            ├─ 試行 2（失敗時）: 同上
            └─ 試行 3（失敗時）: 同上 → 上限到達で throw
```

### リトライ対象エラーの識別

JSON パース / スキーマ検証 / author 検証 の失敗は `RetryableGenerationError` クラス（`server/src/batch/withGenerationRetry.ts`）としてラップして throw する。非リトライエラー（ワーカー未設定等）は通常の `Error` のまま throw し、`withGenerationRetry` は `RetryableGenerationError` のみを catch してリトライする。

### バックオフ

なし（即再試行）。LLM の不正フォーマットはプロンプト再送で解消するケースが多く、待機は不要。

## 5. 影響範囲 / 既存への変更

- `server/src/batch/withGenerationRetry.ts`（新規）: リトライロジックとエラークラスを定義
- `server/src/batch/runPostBatch.ts`（変更）: `processCommunitePosts` 内で `withGenerationRetry` を使用
- `server/src/batch/runCommentBatch.ts`（変更）: `processCommunityComments` 内で `withGenerationRetry` を使用
- `server/src/batch/withGenerationRetry.test.ts`（新規）: リトライロジックのユニットテスト
- `server/src/batch/runPostBatch.test.ts`（変更）: リトライ統合テストを追加
- `server/src/batch/runCommentBatch.test.ts`（変更）: リトライ統合テストを追加

## 6. テスト計画

### `withGenerationRetry.test.ts`（単体テスト）

- 最初の試行で成功 → リトライなし
- 1 回失敗後に成功 → 2 回試行
- 2 回失敗後に成功 → 3 回試行
- 3 回連続失敗 → 最後のエラーを throw
- 非リトライエラーは即 throw（リトライしない）

### `runPostBatch.test.ts` / `runCommentBatch.test.ts`（統合テスト）

- JSON パース失敗 → 1 回リトライで成功 → post/comment が永続化される
- 3 回失敗でリトライ上限到達 → `batchRunLog.status === 'failure'`
- author 検証失敗 → 1 回リトライで成功

## 7. リスク・未決事項

- `runPostBatch` / `runCommentBatch` は 1 定時 = 1 コミュニティ（ADR-0030）のため、
  リトライによる API コール増加は最大 2 コール（失敗数）に限定される。コスト影響は軽微。
- 将来的に `runCommentBatch` でも同一ユーティリティを使うため、共通化は適切。
