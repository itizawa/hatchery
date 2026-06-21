# 設計書: インスタンス遷移時の道連れ500とerrorHandlerのログ欠落を解消する (#862)

## 1. 目的 / 背景

本番 `hatchery-prod`（Cloud Run）で post ページを開いた際の 500 エラー報告を起点に調査した。

Cloud Run ログから判明した事実:

- 500 は単一エンドポイントではなく、1 回のページ読込で叩く**全エンドポイントが同時に 500**（`/api/posts/{id}`・`/api/auth/me`・`/api/communities`・`/api/communities/{slug}/subscription`）。
- 直近 1 日で 23 件、すべて**バースト集中**（10:58×8 / 12:57×5 / 11:25×5）。その前後は正常。
- 10:58 のバースト直後に `Starting new instance. Reason: DEPLOYMENT_ROLLOUT` ログ。500 は**インスタンス遷移（デプロイ/スケール）中**に集中。`minScale=0 / maxScale=3` のゼロスケール構成でインスタンスが頻繁に入れ替わる。

### 根本原因

1. **graceful shutdown 不在**（`server/src/server.ts`）: SIGTERM ハンドラ・`server.close()`・`prisma.$disconnect()` が無く、Cloud Run の SIGTERM でプロセスが即殺され、処理中リクエストが道連れで 500 になる。
2. **errorHandler の例外握り潰し**（`server/src/middleware/errorHandler.ts`）: 500 変換時に元例外をログせず、Cloud Run の ERROR ログ本文が空 → 原因追跡不能（観測性欠陥）。

## 2. スコープ（やること / やらないこと）

### やること

- `errorHandler` で 500 変換時に「メソッド・URL・例外（スタック付き）」を `console.error` 出力。
- `server/src/lifecycle/gracefulShutdown.ts` を新設（テスト可能な純関数 + シグナル登録ヘルパー）。
- `server.ts` に graceful shutdown を配線し、起動時 `prisma.$connect()` を前倒し。

### やらないこと

- Cloud Run `minScale` の変更（コスト判断のため運用側で別途）。
- リトライ/サーキットブレーカ等のアプリ内 DB 再接続戦略（Prisma 既定に委ねる）。
- ロガーライブラリ導入（既存同様 `console.*` を踏襲）。

## 3. 受け入れ条件（テストに落とせる粒度）

1. `errorHandler` は 500 に変換する想定外例外を `console.error` で 1 回、メソッド・URL・例外オブジェクトとともに出力する。
2. `errorHandler` は AppError（4xx）・413 など想定内エラーでは `console.error` しない。
3. `gracefulShutdown` は `server.close`（in-flight 排出）→ `disconnect` の順で実行し、解決する。
4. `gracefulShutdown` は close/disconnect が失敗しても reject せず `onError` に渡して継続する。
5. `registerGracefulShutdown` は SIGTERM 受信で shutdown を実行し `exit(0)`、多重シグナルでも shutdown は 1 回だけ。
6. `server.ts` 起動時に `prisma.$connect()` を実行し、失敗時はログに残す。
7. 既存テスト・typecheck・lint がすべて緑。

## 4. 設計判断

- **テスト容易性**: シグナル/プロセス終了/DB 切断はすべて DI（`process`・`exit`・`disconnect`）で差し替え可能にし、純関数 `gracefulShutdown` と薄い `registerGracefulShutdown` に分離。実 SIGTERM やプロセス kill に依存しないユニットテストにした。
- **shutdown 経路で throw しない**: 終了処理中の例外は `onError` に流して握り、`server.close`/`disconnect` のどちらが失敗しても残りの処理と `exit(0)` を必ず通す。
- **想定内 4xx/413 はログしない**: ノイズを避け、調査価値のある 5xx のみ記録。
- **関数引数規約（#720）**: 公開関数はオブジェクト引数。Express のエラーハンドラのみ I/F 都合で `eslint-disable max-params`（既存踏襲）。

## 5. テスト結果

- 新規/変更テスト: `errorHandler.test.ts`（+2）・`lifecycle/gracefulShutdown.test.ts`（新規 5）すべて緑。
- server 全体: 922 passed / 147 skipped（DB 必要な統合テストの skip）。typecheck・lint 緑。

## 6. ユーザー可視の振る舞い

変化なし（純粋なバックエンド堅牢化）。よって `e2e/` usecases の更新は不要。
