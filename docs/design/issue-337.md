# 設計書: admin 系 5 エンドポイントを OpenAPI registry に登録し client の as any ワークアラウンドを撤去する (#337)

## 1. 目的 / 背景

ADR-0006 の OpenAPI 一方向フロー（common Zod → server openapi.json → client 型生成）に未登録のまま残っている admin 系エンドポイントを registry に登録し、client 側の `(openApiClient as any)` ワークアラウンド・`eslint-disable`・「#305 マージ待ち」NOTE コメントを撤去して HTTP 境界の型安全性を回復する。

ブロッカーだった #305 は既にマージ・クローズ済みであり、ワークアラウンドだけが残存している期限切れ技術的負債。

**注意（Issue 本文との差分）**: Issue 本文の表は #329（Employee→Worker 全層リネーム）以前の記述で `/api/admin/employees` を挙げているが、現行コードでは既に `/api/admin/workers` にリネーム済み（`server/src/routes/admin.ts`・`client/src/api/admin.ts`）。実装は現行の `/api/admin/workers` パスに合わせる。

## 2. スコープ（やること / やらないこと）

### やること
- `server/src/openapi/registry.ts` に以下 5 エンドポイントを `registerPath` で登録:
  - `GET /api/admin/communities` → `Community[]`
  - `POST /api/admin/communities` → 201 `Community`（body: `CreateCommunity`）
  - `PATCH /api/admin/communities/{id}` → `Community`（body: `UpdateCommunity`）
  - `POST /api/admin/workers` → 201 `Worker`（body: `CreateWorker`）
  - `DELETE /api/admin/workers/{id}` → 200 `{ id, deletedAt }`
- スキーマは common の Zod（`CommunitySchema` / `CreateCommunitySchema` / `UpdateCommunitySchema` / `WorkerSchema` / `CreateWorkerSchema`）を単一情報源とする。
- 上記 5 パス（メソッド含む）が `openapi.json` に含まれることを検証するテストを TDD で追加。
- `client/src/api/admin.ts`・`client/src/api/communities.ts` の `as any` 5 箇所・`eslint-disable-next-line @typescript-eslint/no-explicit-any`・「#305 マージ待ち」NOTE を撤去し、生成型のまま型安全に呼ぶ。不要になる戻り値 `as` キャストも撤去する。

### やらないこと
- `adminWorkerImage`（multipart 画像アップロード）の OpenAPI 登録（スコープ外）。
- `/api/admin/invitations` 系（client から as any で呼ばれていない）。
- 挙動変更（エラーハンドリング・`CommunitySchema.parse`・TanStack Query キャッシュ無効化はそのまま）。

## 3. 受け入れ条件（テストに落とせる粒度）

1. `generateOpenApiDocument()` の出力 `paths` に次の 5 パス×メソッドが含まれる:
   `GET /api/admin/communities`・`POST /api/admin/communities`・`PATCH /api/admin/communities/{id}`・`POST /api/admin/workers`・`DELETE /api/admin/workers/{id}`。
2. `components.schemas` に `CreateCommunity`・`UpdateCommunity`・`CreateWorker` が含まれる（Community・Worker は登録済み）。
3. `POST /api/admin/communities` のリクエストボディ参照が `#/components/schemas/CreateCommunity`、201 レスポンスが `#/components/schemas/Community`。
4. `DELETE /api/admin/workers/{id}` の 200 レスポンスが `id`・`deletedAt` プロパティを持つオブジェクト。
5. `pnpm --filter @hatchery/server openapi` が成功し 5 パスを含む openapi.json を出力。
6. client 再生成後、`admin.ts`・`communities.ts` の `as any`・`eslint-disable`・NOTE が全廃され型安全に呼ぶ（既存 client テストはグリーン）。
7. `pnpm turbo run lint test build` と `pnpm typecheck` が全グリーン。

## 4. 設計方針

- `CreateCommunitySchema` / `UpdateCommunitySchema` / `CreateWorkerSchema` を registry に component 登録（`Community` / `Worker` / `UpdateWorker` は既存登録を再利用）。
- 既登録の `/api/admin/settings`・`/api/admin/token-usage` と同じ `registerPath` パターン（認証必須・401/403/404 エラー応答）に倣う。
- `created_at` は `CommunitySchema` の `z.date()` が openapi 上 `string` として出力される（既存 `/api/communities` と同じ）。client は従来通り `new Date(...)` で復元してから `CommunitySchema.parse` する。
- `DELETE /api/admin/workers/{id}` の 200 レスポンスは `z.object({ id: z.string(), deletedAt: z.string() })`（JSON シリアライズ後の ISO 文字列）でインライン定義。

## 5. 影響範囲 / 既存への変更

- server: `server/src/openapi/registry.ts`（登録追加）、`server/src/openapi/registry.test.ts`（テスト追加）。
- client: `client/src/api/communities.ts`・`client/src/api/admin.ts`（ワークアラウンド撤去）。
- common: 変更なし（既存スキーマ流用）。依存方向 client → common / server → common を維持（client は openapi.gen.ts 経由のみ）。

## 6. テスト計画（TDD）

`server/src/openapi/registry.test.ts` に追加:
- 5 パス×メソッドが `doc.paths` に含まれる。
- `components.schemas` に `CreateCommunity`・`UpdateCommunity`・`CreateWorker`。
- `POST /api/admin/communities` の req body=`CreateCommunity` / 201 res=`Community` の $ref。
- `PATCH /api/admin/communities/{id}` の req body=`UpdateCommunity` / 200 res=`Community`。
- `POST /api/admin/workers` の req body=`CreateWorker` / 201 res=`Worker`。
- `DELETE /api/admin/workers/{id}` の 200 res が `id`・`deletedAt` を持つ。

## 7. リスク・未決事項

- client 側 `as any` 撤去後、生成型で `created_at: string` のため `new Date(data.created_at)` の引数型が string になり問題なし。既存テストで挙動を担保。
- リクエストスキーマは既存流用のため新規 `z.string()` ユーザー入力フィールド追加なし（`.max()` は既存スキーマに設定済み）。
