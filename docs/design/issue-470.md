# 設計書: Issue #470 バッチ処理のログ出力（console 直書き）を構造化して統一する

## 背景・目的

定時バッチ配下（`server/src/batch/`）が `console.log` / `console.error` / `console.warn` を直書きしており、出力形式・ペイロードが不統一。HTTP 側は `requestLogger.ts` を持つのに対し、バッチ側に共通のログ抽象が無い。バッチは長時間・無人実行（Cloud Run Jobs）で動くため、ログのパース・集約しやすさが運用に直結する。

本 Issue では **バッチ用の薄い構造化ログヘルパに統一**し、メッセージ形式とペイロードの一貫性を確保する（外部ログ基盤への送出設計はスコープ外）。

## 受け入れ条件 → 入出力

### AC1: バッチ用ログヘルパ `server/src/batch/logger.ts`

- `logBatchInfo(event: string, fields?: BatchLogFields): void`
- `logBatchError(event: string, err: unknown, fields?: BatchLogFields): void`
- `event` 名と任意フィールドを **JSON 1 行**で出力する（機械解析しやすさを優先）。

出力フォーマット（1 行 JSON）:

```json
{"level":"info","event":"community_batch.completed","posts":3,"comments":5}
{"level":"error","event":"community_batch.failed","error":"boom","communityId":"c1"}
```

- 共通フィールド: `level`（`"info"` | `"error"`）, `event`。
- `logBatchError` は `err` から **メッセージ抽出をヘルパに集約**して `error` フィールドに入れる（`err instanceof Error ? err.message : String(err)`）。
- `fields` は `Record<string, unknown>` で任意の構造化フィールドを付与。`level` / `event` / `error` は予約キーとしてヘルパが管理する（fields で上書きしない設計だが、衝突時はヘルパ側の値を優先）。
- 出力先: info は `console.log`、error は `console.error`（既存の標準出力/標準エラー分離を維持）。
- テスト容易性: 内部で `JSON.stringify` した 1 行を出力。テストは `vi.spyOn(console, ...)` でキャプチャしパースして検証。

`BatchLogFields = Record<string, unknown>`。

### AC2: 既存 `console.*` 直書きの置き換え

対象ファイルの `console.*` をヘルパ経由に置換する:

- `schedule.ts:116` `console.error("[batch] 定時実行に失敗しました", err)` → `logBatchError("scheduled_run.failed", err)`
- `runCommunityBatch.ts` の各 `console.error` / `console.warn` → `logBatchError` / `logBatchInfo`（community_id 等を fields に）
- `communityBatchIndex.ts:29,84` 完了ログ・エラーログ → `logBatchInfo` / `logBatchError`
- `aiMessageGenerator.ts` `console.warn` / `console.error` → `logBatchInfo`（warn 相当）/ `logBatchError`

> 備考: ヘルパの level は info/error の 2 値。元の `console.warn` は「警告だが致命的ではない」情報出力なので `logBatchInfo`（fields に `warn: true` 等は付けず event 名で表現）にマッピングする。Error オブジェクトを伴う失敗は `logBatchError`。

### AC3: Error メッセージ抽出の集約

`err instanceof Error ? err.message : String(err)` の重複（runCommunityBatch.ts に複数）を `logBatchError` 内部の `extractErrorMessage` に集約。呼び出し側の重複を削減する。runCommunityBatch では errors 配列に積むためメッセージが必要な箇所が残るが、その抽出も `extractErrorMessage` を export して再利用する。

### AC4: ユニットテスト

`server/src/batch/logger.test.ts` で:

- `logBatchInfo` が `level:"info"` + event + fields を 1 行 JSON で `console.log` に出す
- `logBatchError` が `Error` のとき `error` にメッセージを入れる
- `logBatchError` が 非 Error（文字列・オブジェクト）のとき `String(err)` 相当を入れる
- fields がマージされる / 省略時は event と level のみ
- `extractErrorMessage` の Error/非Error 分岐

### AC5: build / test / lint 緑・import 境界

`server → common` のみ。logger.ts は Node 標準と内部 import のみ（common 不要）。一方向境界を侵さない。

## 設計判断

- **出力形式は JSON 1 行**を採用。`[batch] event key=value` 形式より集約基盤（Cloud Logging 等・将来）でのパースが容易で、ネストや特殊文字を含むフィールドも安全に表現できる。
- **level は info/error の 2 値**に絞る。元 `console.warn` は致命的でない情報出力として info に寄せ、event 名（例: `ai_generation.max_tokens_truncated`）で意味を表現する。warn 専用 API を足すと AC のシンプルさを損なうため見送り。
- **`extractErrorMessage` を export** して runCommunityBatch の errors 配列構築でも再利用し、メッセージ抽出ロジックを 1 箇所に集約する。
- ユーザー可視の振る舞い（画面・API）は変わらない純粋なバックリファクタのため **e2e/usecases は更新不要**。

## event 名一覧（命名規約: `<domain>.<event>` snake_case）

| 旧 console | 新 event | level |
|---|---|---|
| schedule 定時実行失敗 | `scheduled_run.failed` | error |
| API キー未設定スキップ | `community_batch.skipped_no_api_key` | info |
| ワーカー 0 件スキップ | `community_batch.skipped_no_workers` | info |
| JSON パース失敗 | `community_batch.json_parse_failed` | error |
| スキーマ検証失敗 | `community_batch.schema_validation_failed` | error |
| author 検証失敗 | `community_batch.author_validation_failed` | error |
| community 処理失敗 | `community_batch.community_failed` | error |
| CLI 完了 | `community_batch.completed` | info |
| CLI 直接実行エラー | `community_batch.cli_failed` | error |
| max_tokens 切り詰め | `ai_generation.max_tokens_truncated` | info |
| Batch ended せず | `ai_generation.batch_not_ended` | info |
| Batch 結果失敗 | `ai_generation.batch_result_failed` | error |
