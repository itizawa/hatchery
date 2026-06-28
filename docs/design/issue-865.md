# 設計書: HTTP(APIサーバ)側に構造化ログ抽象を導入しログ方式を統一する (#865)

## 1. 目的 / 背景

#862（本番500障害）の調査で API サーバ側のログが原因追跡しづらいことが判明。定時バッチには `batch/logger.ts`（#470）で構造化ログがあるが、HTTP 側は `console.log/error` + `[prefix]` タグのアドホックなログのみ。Cloud Run（Cloud Logging）上で `jsonPayload` を活用した検索・絞り込み・アラートを可能にするため、HTTP 側にも構造化ログ抽象を導入する。

## 2. スコープ（やること / やらないこと）

### やること
- HTTP 側の構造化ログヘルパ `server/src/logger.ts` を新設
- `errorHandler.ts` の 500 ログを構造化（`event:"http.500"` + method/path/error/stack）に置換
- `server.ts`（listen / DB 接続）と `health.ts` のログを構造化に置換
- `gracefulShutdown.ts` のデフォルトログ出力を構造化に変更
- Cloud Logging の `severity` フィールド（INFO/ERROR）を付与
- ユニットテストで JSON 形状・stack 保持・4xx 非出力を担保

### やらないこと
- `batch/logger.ts` の修正（バッチ側は既に動作しており変更不要）
- morgan（リクエストアクセスログ）の構造化（別 Issue で対応可能）
- CLI スクリプト（`generateReleaseNotes.ts`、`openapi/generate.ts`）のログ変更
- Cloud Monitoring のメトリクス/アラート設定（運用タスク）
- trace 相関フィールドの実装（方針のみ記載）

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

1. `logInfo(event, fields?)` が `{severity:"INFO", level:"info", event, ...fields}` を 1 行 JSON で `console.log` に出力する
2. `logError(event, err, fields?)` が `{severity:"ERROR", level:"error", event, error, stack, ...fields}` を 1 行 JSON で `console.error` に出力する
3. `logError` は Error の `stack` を保持する（`batch/logger.ts` との差分）
4. `logError` は非 Error（文字列等）では `error: String(err)` を出し、`stack` は省略する
5. 予約キー（`level`, `severity`, `event`, `error`, `stack`）は fields で上書きできない
6. `errorHandler.ts` の 500 ログが `{event:"http.500", method, path, error, stack}` の構造化 JSON になる
7. `errorHandler.ts` の 5xx AppError ログが `{event:"http.error", statusCode, method, path, error, stack}` になる
8. 4xx / 413 はログしない既存挙動を維持
9. `server.ts` のライフサイクルログ（DB接続/listen/エラー）が構造化される
10. `health.ts` のヘルスチェック失敗ログが構造化される
11. `gracefulShutdown.ts` のデフォルトログ出力が構造化される（DI で差し替え可能な設計は維持）
12. 全テスト緑・typecheck・lint 通過

## 4. 設計方針（アーキ・データ構造・主要モジュール）

### バッチ側 logger との関係: 別モジュールとして維持

`batch/logger.ts` と HTTP 側 `logger.ts` は**意図的に別モジュール**とする。理由:

- **stack trace の要件が異なる**: バッチ側は `err.message` のみで十分（長時間バッチの大量ログで stack が冗長）。HTTP 側は 500 障害の原因追跡に stack が必須。
- **event 名前空間が異なる**: バッチは `community_batch.*`、HTTP は `http.*` / `server.*` / `health.*`。
- **変更リスクの隔離**: バッチ側は #470 で安定稼働中。HTTP 側の変更がバッチに波及しない。

将来的に共通化する場合は `server/src/lib/structuredLog.ts` に基盤を切り出し、両方がそれを wrap する形が考えられるが、現時点では YAGNI。

### JSON ペイロード構造

```json
{
  "severity": "INFO",
  "level": "info",
  "event": "server.listening",
  "port": 3000
}
```

```json
{
  "severity": "ERROR",
  "level": "error",
  "event": "http.500",
  "error": "Cannot read properties of undefined",
  "stack": "Error: Cannot read properties of undefined\n    at ...",
  "method": "GET",
  "path": "/api/communities"
}
```

- `severity`: Cloud Logging が認識するフィールド（INFO / ERROR）。ログベースのメトリクス・アラートで使う。
- `level`: アプリ内の慣習（batch/logger.ts と合わせて `info` / `error`）。
- `event`: ドット区切りの識別子。Cloud Logging でフィルタ可能。

### Cloud Logging trace 相関（将来方針）

Cloud Run は `X-Cloud-Trace-Context` ヘッダを付与する。リクエストスコープのログに `logging.googleapis.com/trace` フィールドを追加すれば、同一リクエストのログをグループ化できる。ただしこれはミドルウェアでリクエストごとにコンテキストを伝搬する仕組みが必要で、本 Issue のスコープ外。将来 Issue として起票可能。

## 5. 影響範囲 / 既存への変更（対象ワークスペース: server）

| ファイル | 変更内容 |
|---------|--------|
| `server/src/logger.ts` | **新規作成**: HTTP 側構造化ログヘルパ |
| `server/src/logger.test.ts` | **新規作成**: ユニットテスト |
| `server/src/middleware/errorHandler.ts` | `console.error` → `logError` に置換 |
| `server/src/middleware/errorHandler.test.ts` | 構造化 JSON 出力の検証に更新 |
| `server/src/server.ts` | `console.log/error` → `logInfo/logError` に置換 |
| `server/src/routes/health.ts` | `console.error` → `logError` に置換 |
| `server/src/lifecycle/gracefulShutdown.ts` | デフォルト `log`/`onError` を構造化ログに変更 |

client / common / docs への変更なし。

## 6. テスト計画（TDD で書くテスト一覧）

### server/src/logger.test.ts（新規）
- `logInfo` が `severity:INFO`, `level:info`, `event` を JSON で `console.log` に出す
- `logInfo` が fields をマージする
- `logInfo` が `console.error` に出力しない
- `logError` が Error のとき `error`(message) + `stack` を JSON で `console.error` に出す
- `logError` が `severity:ERROR` を含む
- `logError` が非 Error のとき `error: String(err)` で `stack` を省略する
- `logError` が fields をマージする
- `logError` が `console.log` に出力しない
- 予約キーが fields で上書きされない
- `extractErrorInfo` が Error なら message + stack を返す
- `extractErrorInfo` が非 Error なら message のみ返す

### server/src/middleware/errorHandler.test.ts（既存テストの更新）
- 500 ログが構造化 JSON（`event:"http.500"`, `method`, `path`, `error`, `stack`）で出力される
- 5xx AppError ログが構造化 JSON（`event:"http.error"`, `statusCode`）で出力される
- 4xx / 413 がログされない（既存テストのまま）

## 7. リスク・未決事項

- **morgan のアクセスログ**: 現状 `combined` フォーマット（テキスト）のまま。構造化すると Cloud Logging での解析が容易になるが、本 Issue のスコープ外。
- **gracefulShutdown のDI**: デフォルトを構造化ログに変更するが、テストでは引き続きカスタムコールバックを注入する設計を維持。テストへの影響なし。
