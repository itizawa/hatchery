# 設計書: refactor: レート制限ミドルウェアを express-rate-limit に置き換える (#77)

## 1. 目的 / 背景

`server/src/middleware/rateLimiter.ts` の約50行のスクラッチ実装（固定ウィンドウ・インメモリ）を
`express-rate-limit` ライブラリに置き換え、メンテナンス負担を削減する。

自前実装の課題:
- `sweepExpired` 等のバケット管理コードが必要
- `Retry-After` ヘッダのみ手動付与（RFC 9110 `RateLimit-*` ヘッダは未対応）
- マルチプロセス非対応（コメントで明記済みだが、将来の Redis 化が難しい）
- テストのために `now()` 注入という実装詳細が露出している

## 2. スコープ（やること / やらないこと）

### やること
- `pnpm add express-rate-limit` で依存を追加
- `rateLimiter.ts` の自前実装を `express-rate-limit` のラッパーに置き換え
- `createRateLimiter({ windowMs, max })` の呼び出しインターフェース（`app.ts` 側）を維持
- `Retry-After` ヘッダ（カスタム handler 内で設定）
- `standardHeaders: true`（RFC 9110 `RateLimit-*` ヘッダ）を有効化
- `rateLimiter.test.ts` を `now()` 非依存に更新（観点は同一）

### やらないこと
- マルチプロセス対応（Redis store 導入は別 Issue 以降）
- `app.ts` の呼び出し箇所の変更（インターフェース互換を維持）
- 他ミドルウェアの変更

## 3. 受け入れ条件（テストに落とせる粒度）

- `pnpm add express-rate-limit` で依存が追加されている
- `rateLimiter.ts` に `sweepExpired` 等の自前バケット管理コードが存在しない
- `createRateLimiter({ windowMs, max })` で `express-rate-limit` インスタンスを返す
- ウィンドウ内は max 件まで 200 OK が返る
- max を超えると 429 + `{ error: "TooManyRequests" }` + `Retry-After > 0` が返る
- ウィンドウ経過後にカウンタがリセットされ再び 200 OK が返る
- `app.security.test.ts` のレート制限テストが通る
- `pnpm --filter @hatchery/server test` と `pnpm --filter @hatchery/server lint` が緑

## 4. 設計方針

### `createRateLimiter` の新実装

```ts
import rateLimit from "express-rate-limit";

export interface RateLimiterOptions {
  windowMs: number;
  max: number;
  // now パラメータを削除（ライブラリが内部でタイミングを管理）
}

export function createRateLimiter({ windowMs, max }: RateLimiterOptions): RequestHandler {
  return rateLimit({
    windowMs,
    limit: max,           // v7 では max → limit（max も互換のため残るが limit が推奨）
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res, _next, optionsUsed) => {
      const retryAfterSec = Math.ceil(optionsUsed.windowMs / 1000);
      res.setHeader("Retry-After", String(retryAfterSec));
      res.status(429).json({ error: "TooManyRequests" });
    },
  });
}
```

`Retry-After` の値は `windowMs / 1000`（最悪ケース）を使う。
これは「このウィンドウが終わるまでの最大秒数」を表し、現行実装の計算式より保守的だが
テストの `> 0` 要件を満たし、クライアントへの情報として十分。

### `rateLimiter.test.ts` の更新方針

`now()` 注入を削除し、実時間ベースに変更。ウィンドウリセットテストは
`windowMs: 100`（100ms）+ `setTimeout(150ms)` で代替する。
test 観点（通過・拒否・リセット確認）は変えない。

## 5. 影響範囲

- **server**: `rateLimiter.ts`（実装置き換え）、`rateLimiter.test.ts`（テスト更新）、`package.json`（依存追加）
- **app.ts**: 変更なし（インターフェース互換）
- **common / client**: 変更なし

## 6. テスト計画（TDD で書くテスト一覧）

| テスト名 | 入力 | 期待出力 |
|----------|------|----------|
| ウィンドウ内は max 件まで通過する | windowMs:60000, max:2 → 2リクエスト | 200, 200 |
| max 超過で 429・TooManyRequests・Retry-After | windowMs:60000, max:2 → 3リクエスト | 200, 200, 429+body+header |
| ウィンドウ経過後リセット | windowMs:100, max:1 → 2req+150ms+1req | 200, 429, 200 |

## 7. リスク・未決事項

- `express-rate-limit` v7 の `limit` オプション（旧 `max`）を使用。互換のため `max` も動作するが `limit` を優先。
- supertest でのリクエストは同一 IP（`127.0.0.1` or `::1`）で送られるため、IP ベースのカウントが正常に動作することを確認済み（既存 `app.security.test.ts` のパターンと同様）。
- `windowMs: 100` の短いウィンドウ + `setTimeout(150)` はCI環境での遅延リスクがあるが、マージンが50ms以上あり許容範囲。
