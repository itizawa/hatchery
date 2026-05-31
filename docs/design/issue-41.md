# 設計書: API 型共有パイプライン実装（OpenAPI + openapi-typescript） (#41)

## 1. 目的 / 背景

ADR-0006 が定める **OpenAPI を HTTP 境界の単一情報源とする一方向型共有フロー**を完成させる。

```
common: Zod スキーマ → server: zod-to-openapi で openapi.json 生成 → client: openapi-typescript で型生成 → openapi-fetch + TanStack Query で利用
```

### 現状調査（着手前）

本 Issue の **パイプライン基盤は既に存在する**（過去 Issue で段階的に整備済み）:

- `server/src/openapi/registry.ts` … `@asteasolutions/zod-to-openapi` で OpenAPI 3.1 ドキュメントを生成。`/messages`・`/channels/{channelId}/employees` 系を登録済み。
- `server/src/openapi/generate.ts` … `server/openapi.json` をファイル出力。
- `client/src/api/client.ts` … `openapi-fetch` の型安全クライアント（`paths` 型を消費）。
- `client/src/api/scenes.ts` … `openApiClient.GET("/messages")` を TanStack Query で利用。
- `turbo.json` … `server:openapi → client:gen-types → @hatchery/client#build` の順序依存を定義済み。
- `client/src/api/openapi.gen.ts` は `.gitignore` 済み（生成物・非コミット）。

### 残ギャップ（本 Issue で埋める）

受け入れ条件に対して未達なのは以下の 2 点のみ:

1. **server**: `createApp` が登録する全エンドポイントのうち、`/auth/login`・`/auth/logout`・`/auth/me`・`/health` が **OpenAPI spec に含まれていない**（受け入れ条件「`server/src/routes/` の各エンドポイントが spec に含まれる」「`/auth/login` の response/error も spec に」未達）。
2. **client**: 「最小 1 つのエンドポイント（例: `GET /auth/me`）で end-to-end に型が流れることを示すテスト」が無い。`auth.ts` は生の `fetch` を使っており、生成型を経由していない。

## 2. スコープ（やること / やらないこと）

### やること

- server: OpenAPI レジストリに `/auth/login`・`/auth/logout`・`/auth/me`・`/health` を、common の Zod スキーマ（`LoginRequestSchema` / `AuthUserSchema`）と実装が実際に返す形に**忠実な** request / response / error スキーマで登録する。
- client: `GET /auth/me` を生成型経由の `openApiClient`（openapi-fetch）で呼ぶよう `fetchMe` を移行し、end-to-end の型フローを示すランタイムテストを追加する（公開シグネチャは不変＝既存フック・テストを壊さない）。

### やらないこと（#41 のスコープ外を踏襲）

- ドメイン固有の全エンドポイント実装（本 Issue は基盤完成）。
- GraphQL / gRPC 等の代替スキーム、API versioning、Swagger UI ホスティング。
- `login` / `logout` クライアント関数の openapi-fetch 移行（`GET /auth/me` の最小 e2e で受け入れ条件は満たされるため、差分を最小化する）。

## 3. 受け入れ条件（テストに落とせる粒度）

- [ ] `generateOpenApiDocument()` の `paths` に `/auth/login`・`/auth/logout`・`/auth/me`・`/health` が含まれる。
- [ ] `components.schemas` に `AuthUser`・`LoginRequest` が含まれる。
- [ ] `/auth/login`(post) の requestBody が `LoginRequest`、`200` レスポンスが `AuthUser` を参照する。
- [ ] `/auth/me`(get) の `200` レスポンスが `AuthUser`、`401` が定義される。
- [ ] エラー応答スキーマは実装の実際の形（`{ error: string }`）に一致する（Issue 例の `{ message }` ではなく実装準拠）。
- [ ] client: `fetchMe()` が `GET /auth/me` を生成型経由（`openApiClient`）で呼び、`200` で `AuthUser`、`401` で `null` を返す（モック fetch でのランタイムテスト）。
- [ ] `pnpm --filter @hatchery/server openapi` → `pnpm --filter @hatchery/client gen-types` が成功し、生成型に `/auth/me` パスが現れる。
- [ ] common / server / client の全テスト緑・lint 緑・build 緑。

## 4. 設計方針

- **spec は実装の鏡**: レジストリの response/error は、実際のルートハンドラ（`routes/auth.ts`）・ミドルウェア（`validateBody` の `400 {error,issues}`、`errorHandler` の `500 {error}`）が返す形に一致させる。Issue 本文の `{ user: AuthUser }` / `{ message }` は説明用の例であり、実装は `AuthUser` 直返し・`{ error }` 形なので**実装に合わせる**（spec が嘘をつかない）。
- **依存方向（ADR-0005/0006）厳守**: スキーマの正本は `common`。server はそれを import して登録、client は生成型のみを消費（client→common / server→common の一方向）。
- **公開シグネチャ不変**: `fetchMe` の戻り値（`AuthUser | null`）を維持し、内部実装のみ `openApiClient` に差し替える。`LoginScene.test.tsx` 等は `fetchMe` をモジュール境界でスパイしているため影響しない。

## 5. 影響範囲 / 既存への変更

- `server/`: `src/openapi/registry.ts`（パス追加）、`src/openapi/registry.test.ts`（テスト追加）。
- `client/`: `src/api/auth.ts`（`fetchMe` を openapi-fetch 化）、`src/api/auth.test.ts`（新規 e2e テスト）。
- `docs/`: 本設計書。
- 生成物（`server/openapi.json` / `client/src/api/openapi.gen.ts`）は `.gitignore` 済みでコミットしない。

## 6. テスト計画（TDD）

1. **server（registry.test.ts）**: 新パス・新コンポーネントの存在と参照を assert（先に書いて RED）→ `registry.ts` 実装で GREEN。
2. **client（auth.test.ts）**: `globalThis.fetch` をモックし、`fetchMe()` が `200`→`AuthUser` / `401`→`null` を返すことを assert（生成型経由）。型フローは `tsc -b`（build）で機械検証。

## 7. リスク・未決事項

- `openapi-fetch` の `GET` は非 2xx を `error` で返す。`401` を「未ログイン＝`null`」に正しくマップするため `response.status` を見る（例外にしない）。
- generated 型は非コミットのため、CI/別環境では build 前に必ず `openapi → gen-types` を流す必要がある（turbo 順序依存で担保済み）。
