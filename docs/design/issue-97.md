# 設計書: リクエストログミドルウェアを追加してサーバーログを見やすくする (#97)

## 1. 目的 / 背景

現状、サーバーへのリクエスト情報がログに出力されず、開発中のデバッグが困難。
`morgan` を用いたリクエストロガーミドルウェアを追加し、メソッド・パス・ステータスコード・レスポンスタイムを1行で出力できるようにする。

## 2. スコープ（やること / やらないこと）

### やること
- `morgan` を `@hatchery/server` の依存に追加する
- `server/src/middleware/requestLogger.ts` に `createRequestLogger` ファクトリを実装する
  - `NODE_ENV !== "production"` のとき: `dev` フォーマット（色付き）
  - `NODE_ENV === "production"` のとき: `combined` フォーマット（色なし・詳細）
- `server/src/app.ts` の前段（CORS・セキュアヘッダの後、レート制限の前）に組み込む
- テストのノイズ除去のため、テスト環境（`NODE_ENV === "test"` または stream 未指定テスト）ではログ出力をスキップできるようにする

### やらないこと
- 外部ログ収集基盤との連携
- pino / winston への全面移行
- アクセスログのファイル出力・永続化

## 3. 受け入れ条件（テストに落とせる粒度で箇条書き）

- `GET /health` にリクエストを送ると `GET /health 200 Xms` 形式の行がストリームに出力される
- 存在しないエンドポイント（`GET /not-found`）で 404 のログが出る
- `NODE_ENV=production` では `combined` フォーマット（HTTP バージョンを含む形式）になる
- `NODE_ENV=test` または stream 未指定時はログ出力がスキップされる（テストのノイズにならない）
- 既存テストがすべて緑のまま（ログ出力がテストのノイズにならない）

## 4. 設計方針（アーキ・データ構造・主要モジュール）

### `createRequestLogger(stream?)` の設計

```ts
import morgan from "morgan";
import type { RequestHandler } from "express";
import type { StreamOptions } from "morgan";

export function createRequestLogger(stream?: StreamOptions): RequestHandler {
  // テスト環境では no-op ミドルウェアを返す（ストリームが未指定かつ NODE_ENV=test）
  if (process.env.NODE_ENV === "test" && !stream) {
    return (_req, _res, next) => next();
  }
  const format = process.env.NODE_ENV === "production" ? "combined" : "dev";
  return morgan(format, stream ? { stream } : undefined);
}
```

### `app.ts` への組み込み位置

CORS・セキュアヘッダの直後かつレート制限の前に配置する（全リクエストを記録しつつ、レート制限で弾かれたリクエストのログも残す）:

```ts
app.use(createSecureHeaders(...));
app.use(createCors(...));
app.use(createRequestLogger()); // ← ここ
app.use(createRateLimiter(...));
```

### テストの方針

`createRequestLogger` にカスタム `stream` を渡すことで出力先をキャプチャできる。既存の `app.ts` テストへの影響は、`NODE_ENV=test` 時に no-op になることで回避する。

## 5. 影響範囲 / 既存への変更

- `server/package.json`: `morgan` / `@types/morgan` 追加
- `server/src/middleware/requestLogger.ts`: 新規
- `server/src/middleware/requestLogger.test.ts`: 新規
- `server/src/app.ts`: `createRequestLogger()` の呼び出し追加

## 6. テスト計画（TDD で書くテスト一覧）

1. `GET /health` のリクエストログが stream に出力される（メソッド・パス・ステータスを含む）
2. 存在しないエンドポイントで 404 のログが出る
3. `NODE_ENV=production` では `combined` フォーマット（HTTP バージョンを含む行）が出力される
4. `NODE_ENV=test` かつ stream 未指定では no-op（ログが出力されない）

## 7. リスク・未決事項

- morgan の `dev` フォーマットは ANSI エスケープコードを含むため、CI ログが若干読みにくくなる可能性がある（許容範囲）
- `combined` フォーマットはリバースプロキシを経由する場合に IP が正しくならない可能性があるが、本 MVP では単一プロセス前提のため許容
