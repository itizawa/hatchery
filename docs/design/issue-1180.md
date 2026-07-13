# 設計書: worker画像アップロードAPIをOpenAPIに登録し、画像アップロード系レスポンスの as アサーションを解消する (#1180)

## 1. 目的 / 背景

ADR-0006 の型共有方針（`common: Zod スキーマ → server: openapi.json 生成 → client: openapi-typescript で型生成`）から、画像アップロード系の2エンドポイントが外れている。

1. `POST /api/admin/workers/:id/image`（`server/src/routes/adminWorkerImage.ts`）が OpenAPI レジストリ（`server/src/openapi/registrations/registerWorkers.ts`）に未登録で、`server/openapi.json` にも生成 client 型にも現れない。
2. `client/src/api/workers.ts`（`useUploadWorkerImage`）・`client/src/api/communities.ts`（`uploadCommunityImage`）は multipart/form-data のため生 `fetch` を使う（これは妥当・変更しない）が、レスポンス型を手書きインライン型 + `as` アサーションで宣言しており、サーバ側レスポンス形状の変更を型エラーで検知できない。community icon/cover は既に `registerCommunities.ts` に **インライン** `z.object()` としてレスポンス登録済みだが、named component ではないため client から `components["schemas"][...]` として参照できない。

## 2. スコープ（やること / やらないこと）

**やること**

- server: `POST /api/admin/workers/:id/image` を `registerWorkers.ts` に登録する（`registerCommunities.ts` の icon/cover 登録パターンに倣う）。
- server: community icon/cover のレスポンススキーマを、既存のインライン `z.object()` から named component（`registry.register(...)`）に変更する（`registerAdmin.ts` の `TokenUsageSummaryComponent` 等と同じパターン）。
- server: `registry.snapshot.test.ts` の baseline fixture（`openapi.baseline.json`）を意図的なスキーマ変更として再生成する。
- client: `useUploadWorkerImage`（`workers.ts`）のレスポンス型を `components["schemas"]["WorkerImageUploadResponse"]` 参照に変更し `as Promise<{...}>` を除去する。
- client: `uploadCommunityImage`（`communities.ts`）のレスポンス型を、icon/cover それぞれの実際のレスポンス形状に即した named component の合併型（`components["schemas"]["CommunityIconUploadResponse"] | components["schemas"]["CommunityCoverUploadResponse"]`）に変更する。従来の 1 つにまとめた（iconUrl・coverUrl 両方 optional の）型より実態に即した型にする。

**やらないこと（スコープ外・Issue 本文に明記）**

- openapi-fetch 自体の multipart/form-data 対応（アップストリーム未対応のため不可）。生 `fetch` 呼び出し自体は変更しない。
- `uploadCommunityImage` の位置引数を object 引数化すること（#1177 のスコープ。本 Issue はレスポンス型の是正のみ）。

## 3. 受け入れ条件（テストに落とせる粒度）

1. `generateOpenApiDocument()` の `paths["/api/admin/workers/{id}/image"].post` が定義されている。
2. `generateOpenApiDocument()` の `components.schemas` に `WorkerImageUploadResponse`（`id: string`, `imageUrl: string`）が含まれる。
3. `generateOpenApiDocument()` の `components.schemas` に `CommunityIconUploadResponse`（`id: string`, `iconUrl: string | null`）・`CommunityCoverUploadResponse`（`id: string`, `coverUrl: string | null`）が含まれる。
4. `/api/admin/workers/{id}/image` の 200 レスポンスが `#/components/schemas/WorkerImageUploadResponse` を `$ref` で参照している。
5. `/api/admin/communities/{id}/icon`・`/api/admin/communities/{id}/cover` の 200 レスポンスがそれぞれ対応する named component を `$ref` で参照している。
6. `registry.snapshot.test.ts` の baseline fixture が新スキーマで再生成され、テストが緑になる。
7. `pnpm turbo run build test lint` が緑（client 側の型変更が `openapi.gen.ts` 再生成後に typecheck を通ることを含む）。

## 4. 設計方針

- **命名**: community 側は既存の「icon」「cover」で別エンドポイント・別レスポンス形状（`iconUrl` のみ / `coverUrl` のみ）なので、1 つの型にまとめず `CommunityIconUploadResponse` / `CommunityCoverUploadResponse` の 2 component に分ける（Issue 補足「client 側の型は icon/cover 両方を1つの型でまとめており、実際のレスポンス形状と完全一致していない」の是正）。
- **worker 側**: community の icon/cover 登録パターン（multipart body 定義 → named response component → `registerPath`）をそのまま踏襲し、`WorkerImageUploadResponse`（`id`, `imageUrl`）を新設する。
- **client 側の型参照**: 生成型 `components["schemas"][...]` を直接参照する（`Community`・`Post`・`Comment` 等、既存 export と同じパターン）。`uploadCommunityImage` は 1 関数で icon/cover 両方を扱うため、返り値型は union にする。呼び出し元（`useUploadCommunityImage` 等）は既存のまま `iconUrl`/`coverUrl` を optional として扱っているため、union 型でも既存コードへの破壊的変更は生じない。
- **openapi-fetch を使わない理由の継続**: multipart/form-data は openapi-fetch 未対応（Issue 本文にも明記）。生 `fetch` の呼び出し自体・引数パターンは変更せず、レスポンス型の参照元のみ是正する。

## 5. 影響範囲 / 既存への変更（対象ワークスペース）

- **server**: `server/src/openapi/registrations/registerWorkers.ts`（`POST /api/admin/workers/{id}/image` 登録追加）・`server/src/openapi/registrations/registerCommunities.ts`（icon/cover レスポンスを named component 化）・`server/src/openapi/registry.test.ts`（新規アサーション追加）・`server/src/openapi/__fixtures__/openapi.baseline.json`（再生成）。
- **client**: `client/src/api/workers.ts`（`useUploadWorkerImage` の返り値型）・`client/src/api/communities.ts`（`uploadCommunityImage` の返り値型）。
- **common**: 変更なし（画像アップロードのレスポンス形状は HTTP 境界固有で、ドメインモデルではないため server の OpenAPI レジストリ内で完結させる。既存の `TokenUsageSummaryComponent` 等と同じ判断）。
- **e2e**: ユーザー可視の振る舞い（画面・遷移・操作結果）は変更しない（型定義・OpenAPI 契約の是正のみ、UI/API の入出力仕様は不変）ため `e2e/usecases.md` の更新は不要。PR 本文にその旨を明記する。

## 6. テスト計画（TDD で書くテスト一覧）

- `server/src/openapi/registry.test.ts` に以下を追加（実装前に追加し失敗を確認する）:
  - `/api/admin/workers/{id}/image` の POST が定義されている。
  - `components.schemas` に `WorkerImageUploadResponse` / `CommunityIconUploadResponse` / `CommunityCoverUploadResponse` が含まれる。
  - `/api/admin/workers/{id}/image` の 200 レスポンスが `WorkerImageUploadResponse` を `$ref` 参照している。
- `server/src/openapi/registry.snapshot.test.ts` は実装後に baseline を再生成して一致させる（新規テスト追加ではなく既存の regression test を通す）。
- client 側は型定義のみの変更（実行時ロジック不変）のため新規ユニットテストは追加しない。既存の `workers.test.ts`・`communities.test.ts`（アップロードのモックテストがあれば）が型変更後も green であることを `pnpm turbo run build test lint` で確認する。

## 7. リスク・未決事項

- baseline fixture の再生成は `pnpm --filter @hatchery/server openapi` の出力をそのまま `__fixtures__/openapi.baseline.json` に反映する（既存 Issue 群と同じ手順）。差分が新規 path・component の追加のみであることを diff で確認する。
- client の `openapi.gen.ts` は生成物でコミットしないため、client 側の型変更が正しくコンパイルされることは CI 相当のローカル `pnpm --filter @hatchery/server openapi && pnpm --filter @hatchery/client gen-types && pnpm turbo run build` で確認する。
