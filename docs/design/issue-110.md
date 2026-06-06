# 設計書: client の API 呼び出しを openApiClient に統一する (#110)

## 1. 目的 / 背景

ADR-0006 / #41 で、`common` の Zod → `server` の `openapi.json` 生成 → `client` の `openapi-typescript` 型生成 → `openapi-fetch` の型安全クライアント `openApiClient`（`client/src/api/client.ts`）で利用する一方向フローが実装済み。しかし `admin.ts` 全体と `auth.ts` の `login` / `logout` / `updateProfile` が **生 `fetch` + 手動 `as` キャスト**のまま残っており、OpenAPI 由来の生成型による検証を素通りさせている。

加えてこの未統一は実害を生んでいる: クロスオリジン配信（#78: Cloudflare Pages × Cloud Run）では `openApiClient` が `VITE_API_BASE_URL`（Cloud Run）を baseUrl として前置するのに対し、生 `fetch("/auth/login")` は **同一オリジン（Cloudflare Pages）相対**へ POST してしまい、静的配信の Pages が **405 Method Not Allowed** を返す。`develop.hatchery.pages.dev/login` でログインできない不具合の直接原因がこれ。本 Issue の統一はこの 405 を恒久的に解消する。

## 2. スコープ（やること / やらないこと）

### やること
- `client/src/api/admin.ts` の `fetchSettings` / `patchSetting` を `openApiClient.GET/PATCH("/admin/settings")` 経由へ置換し、`res.json() as ...` を排除。
- `client/src/api/auth.ts` の `login` / `logout` / `updateProfile` を `openApiClient.POST/PATCH` 経由へ置換（baseUrl 解決により 405 を解消）。
- HTTP レスポンスへの `as` キャストを client から無くす。

### やらないこと
- server 側 registry / エンドポイント仕様の変更（既登録パスを呼ぶだけ）。
- `openApiClient` 本体（`client.ts`）の baseUrl / fetch 委譲ロジックの変更。
- `admin.ts` / `auth.ts` 以外のリファクタ。

## 3. 受け入れ条件（テストに落とせる粒度）

1. `admin.ts` の `fetchSettings` が `openApiClient.GET("/admin/settings")` 経由で、`fetch` に **絶対 URL（baseUrl 前置）の Request** を渡して `/admin/settings` を GET する。成功時 `AppSettingResponse[]` を返し、非 2xx で例外。
2. `admin.ts` の `patchSetting` が `openApiClient.PATCH("/admin/settings", { body })` 経由で `/admin/settings` を PATCH する。成功時 `AppSettingResponse` を返し、非 2xx で例外。`credentials: "include"` を維持。
3. `auth.ts` の `login` / `logout` / `updateProfile` が `openApiClient` 経由で、`fetch` に絶対 URL の Request を渡し、それぞれ `POST /auth/login`・`POST /auth/logout`・`PATCH /auth/me` を呼ぶ。現行の戻り値・例外挙動を維持。
4. client 内に HTTP レスポンスへの `as` キャスト（`res.json() as ...`）が残っていない（grep で 0 件）。
5. 既存テスト（`auth.test.ts` 等）が緑。
6. `turbo run lint test build` が緑。

## 4. 設計方針

- 手本 `channels.ts` / `scenes.ts` の `{ data, error, response }` 分岐に揃える。GET 系は `error` で分岐、ステータス依存（401→null 等）が要るものは `response.status` を見る。
- `admin.ts`: `fetchSettings` は `{ data, error } = await openApiClient.GET("/admin/settings", { credentials: "include" })`、`error` で例外、`data ?? []`。`patchSetting` は `{ data, response } = await openApiClient.PATCH("/admin/settings", { body: { key, value }, credentials: "include" })`、`!response.ok || !data` で例外。
- `auth.ts`: `login`/`updateProfile` は `{ data, response }` を見て `!response.ok || !data` で例外、`logout` は `{ response }` のみ。`fetchMe` の既存パターン（`response.status === 401` → null）は不変。

## 5. 影響範囲 / 既存への変更

- 対象ワークスペース: **client のみ**（`client/src/api/admin.ts`・`auth.ts`、テスト追加）。
- common / server / docs（設計書除く）への変更なし。client → common の一方向依存（ADR-0001）を維持。

## 6. テスト計画（TDD で書くテスト一覧）

- `admin.test.ts`（新規）
  - `fetchSettings` が openApiClient 経由で `/admin/settings` を GET（Request インスタンス・絶対 URL・method=GET）し、配列を返す。
  - `patchSetting` が `/admin/settings` を PATCH（method=PATCH）し、オブジェクトを返す。
- `auth.test.ts`（追加済み・本 PR に同梱）
  - `login` / `logout` / `updateProfile` が openApiClient 経由で絶対 URL の Request を渡し、`POST /auth/login`・`POST /auth/logout`・`PATCH /auth/me` を呼ぶ。

## 7. リスク・未決事項

- 生成型 `openapi.gen.ts` は gitignore 済み。ローカル検証前に `turbo run build`（= server openapi → client gen-types）で生成が必要。
- `openApiClient.PATCH("/admin/settings", { body })` の body 型は生成型に依存。`{ key, value }` が `UpdateAppSetting` と一致することを typecheck で担保する。
