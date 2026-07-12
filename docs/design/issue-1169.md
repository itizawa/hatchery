# 設計書: client/src/api/push.ts の subscribePush/unsubscribePush にテストを追加する (#1169)

## 1. 目的 / 背景

`client/src/api/push.ts` は Web Push 購読の登録（`subscribePush`）・解除（`unsubscribePush`）を行う API ラッパーだが、対応するテストファイルが存在しない。`client/src/api/*.ts` の他ファイル（`admin.ts` / `auth.ts` / `communities.ts` / `subscriptions.ts` 等）は軒並みテストが揃っている中で唯一の欠落であり、成功系・エラー系分岐（`ensureOk` 経由の例外送出）が未検証のまま残っている。

## 2. スコープ（やること / やらないこと）

- やること: `client/src/api/push.test.ts` を新設し、`subscribePush` / `unsubscribePush` の成功系（正しいエンドポイント・メソッド・リクエストボディ）とエラー系（`ensureOk` のエラー分岐で例外を投げる）をテストする。
- やらないこと: `usePushSubscription` 等の React Query フック側のテスト（Issue 本文でスコープ外と明記）。`push.ts` 本体の実装変更（本 Issue はテスト追加のみで実装は既存のまま）。

## 3. 受け入れ条件（テストに落とせる粒度）

1. `client/src/api/push.test.ts` を新設する。
2. `subscribePush` が成功時（201/200 等の 2xx）に `POST /api/push-subscriptions` へ `{ endpoint, p256dh, auth }` を含むボディで、`credentials: "include"` でリクエストすることをテストする。
3. `subscribePush` がサーバエラー応答（例: 401/500）時に例外を投げることをテストする。
4. `unsubscribePush` が成功時（204 等）に `DELETE /api/push-subscriptions` へ `{ endpoint }` を含むボディでリクエストすることをテストする。
5. `unsubscribePush` がサーバエラー応答時に例外を投げることをテストする。

## 4. 設計方針（アーキ・データ構造・主要モジュール）

既存の `client/src/api/subscriptions.test.ts` と同じパターンを踏襲する: `vi.stubGlobal("fetch", fetchMock)` で `globalThis.fetch` を差し替え、`afterEach` で `vi.unstubAllGlobals()` する。`fetchMock.mock.calls[0][0]` が `Request` インスタンスであることを利用し、`request.url` / `request.method` / `request.clone().json()`（ボディ）を検証する。エラー系は `Response` のステータスのみを 4xx/5xx にしたモックを返し `rejects.toThrow()` で検証する。

## 5. 影響範囲 / 既存への変更（対象ワークスペース: client）

`client/src/api/push.test.ts` の新設のみ。`push.ts` 本体・他ワークスペース（server / common）への変更はない。ユーザー可視の振る舞い変更もない（テスト追加のみ）ため e2e usecases の更新は不要。

## 6. テスト計画（TDDで書くテスト一覧）

- `subscribePush (POST /api/push-subscriptions)`
  - 成功時に正しいエンドポイント・メソッド・ボディでリクエストする
  - サーバエラー時に例外を投げる
- `unsubscribePush (DELETE /api/push-subscriptions)`
  - 成功時に正しいエンドポイント・メソッド・ボディでリクエストする
  - サーバエラー時に例外を投げる

## 7. リスク・未決事項

なし。既存パターンの踏襲で完結する小粒度の Issue。
